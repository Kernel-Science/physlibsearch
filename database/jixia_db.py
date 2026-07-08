import logging
import os
from collections.abc import Iterable
from pathlib import Path

from jixia import LeanProject
from jixia.structs import LeanName, Symbol, Declaration, is_internal
from psycopg import Connection
from psycopg.types.json import Jsonb
from psycopg.types.range import Range

logger = logging.getLogger(__name__)


def _get_signature(declaration: Declaration, module_content):
    if declaration.signature.pp is not None:
        return declaration.signature.pp
    elif declaration.signature.range is not None:
        # A range may not land on a UTF-8 boundary; don't let it abort the load.
        return module_content[declaration.signature.range.as_slice()].decode(errors="replace")
    else:
        return ""


def _get_value(declaration: Declaration, module_content):
    if declaration.value is not None and declaration.value.range is not None:
        return module_content[declaration.value.range.as_slice()].decode(errors="replace")
    else:
        return None


def _get_range(declaration: Declaration):
    r = declaration.ref.range
    if r is not None:
        return Range(r.start, r.stop)
    else:
        return None


def run_analysis(project: LeanProject, prefixes: list[LeanName]) -> list[tuple[Path, list[LeanName]]]:
    # Pure CPU analysis, no DB connection involved; this can take 30-90+ min.
    lean_sysroot = Path(os.environ["LEAN_SYSROOT"])
    lean_src = lean_sysroot / "src" / "lean"
    # Each jixia worker loads the full Mathlib environment (~2-3 GB), so the
    # default thread count (CPUs + 4) can exhaust memory and get the process
    # OOM-killed. Cap it via JIXIA_MAX_WORKERS in memory-constrained CI.
    max_workers_env = os.environ.get("JIXIA_MAX_WORKERS")
    max_workers = int(max_workers_env) if max_workers_env else None

    module_lists = []
    for d in project.root, lean_src:
        results = project.batch_run_jixia(
            base_dir=d,
            prefixes=prefixes,
            plugins=["module", "declaration", "symbol"],
            max_workers=max_workers,
        )
        module_lists.append((d, [r[0] for r in results]))
    return module_lists


def load_data(project: LeanProject, analysis: list[tuple[Path, list[LeanName]]], conn: Connection):
    def load_module(data: Iterable[LeanName], base_dir: Path):
        values = []
        for m in data:
            try:
                content = project.path_of_module(m, base_dir).read_bytes()
                docstring = project.load_module_info(m).docstring
            except FileNotFoundError:
                logger.warning("skipping module %s: jixia output not found", m)
                continue
            values.append((Jsonb(m), content, docstring))
        cursor.executemany(
            """
            INSERT INTO module (name, content, docstring) VALUES (%s, %s, %s) ON CONFLICT DO NOTHING
            """,
            values,
        )

    def load_symbol(module: LeanName):
        try:
            symbols = [s for s in project.load_info(module, Symbol) if not is_internal(s.name)]
        except FileNotFoundError:
            logger.warning("skipping module %s: jixia output not found", module)
            return
        values = ((Jsonb(s.name), Jsonb(module), s.kind, s.type_readable if s.type_readable is not None else s.type, s.is_prop) for s in symbols)
        cursor.executemany(
            """
            INSERT INTO symbol (name, module_name, kind, type, is_prop) VALUES (%s, %s, %s, %s, %s) ON CONFLICT DO NOTHING
            """,
            values,
        )
        for s in symbols:
            values = (
                {
                    "source": Jsonb(s.name),
                    "target": Jsonb(t),
                }
                for t in s.type_references
                if not is_internal(t)
            )
            cursor.executemany(
                """
                INSERT INTO dependency (source, target, on_type)
                    SELECT %(source)s, %(target)s, TRUE
                    WHERE EXISTS(SELECT 1 FROM symbol WHERE name = %(target)s)
                ON CONFLICT DO NOTHING
                """,
                values,
            )

            if s.value_references is not None:
                values = (
                    {
                        "source": Jsonb(s.name),
                        "target": Jsonb(t),
                    }
                    for t in s.value_references
                    if not is_internal(t)
                )
                cursor.executemany(
                    """
                    INSERT INTO dependency (source, target, on_type)
                        SELECT %(source)s, %(target)s, FALSE
                        WHERE EXISTS(SELECT 1 FROM symbol WHERE name = %(target)s)
                    ON CONFLICT DO NOTHING
                    """,
                    values,
                )

    def load_declaration(module_name: LeanName):
        try:
            declarations = project.load_info(module_name, Declaration)
        except FileNotFoundError:
            logger.warning("skipping module %s: jixia output not found", module_name)
            return
        cursor.execute(
            """
            SELECT content FROM module WHERE name = %s
            """,
            (Jsonb(module_name),),
        )
        module = cursor.fetchone()
        if module is None:
            logger.warn("couldn't find a module with name '%s'", Jsonb(module_name))
            return
        (module_content,) = module

        db_declarations = []
        for index, decl in enumerate(declarations):
            if is_internal(decl.name) or decl.kind == "proofWanted":
                continue
            db_declarations.append(
                {
                    "module_name": Jsonb(module_name),
                    "index": index,
                    "name": Jsonb(decl.name) if decl.kind != "example" else None,
                    "visible": decl.modifiers.visibility != "private" and decl.kind != "example",
                    "docstring": decl.modifiers.docstring,
                    "kind": decl.kind,
                    "signature": _get_signature(decl, module_content),
                    "value": _get_value(decl, module_content),
                    "range": _get_range(decl),
                }
            )
        cursor.executemany(
            """
            INSERT INTO declaration (module_name, index, name, visible, docstring, kind, signature, value)
            SELECT %(module_name)s, %(index)s, %(name)s, %(visible)s, %(docstring)s, %(kind)s, %(signature)s, %(value)s
                WHERE EXISTS(SELECT 1 FROM symbol WHERE name = %(name)s)
            ON CONFLICT DO NOTHING 
            """,
            db_declarations,
        )

    def topological_sort():
        logger.info("performing topological sort")
        cursor.execute("""
            INSERT INTO level (symbol_name, level)
                SELECT name, 0
                FROM symbol v
                WHERE NOT EXISTS (SELECT 1 FROM dependency e WHERE e.source = v.name)
            ON CONFLICT DO NOTHING
        """)
        while cursor.rowcount:
            logger.info("topological sort: %d rows affected", cursor.rowcount)
            # Find all nodes whose direct predecessors have already been assigned a level
            cursor.execute("""
                INSERT INTO level (symbol_name, level)
                    SELECT e.source AS symbol_name, MAX(l.level) + 1 AS level
                    FROM
                        dependency e LEFT JOIN level l ON e.target = l.symbol_name
                    WHERE NOT EXISTS(SELECT 1 FROM level l WHERE l.symbol_name = e.source)
                    GROUP BY e.source
                    HAVING
                        EVERY(l.level IS NOT NULL) = TRUE
                ON CONFLICT DO NOTHING
            """)

    with conn.cursor() as cursor:
        all_modules = []
        for d, modules in analysis:
            load_module(modules, d)
            all_modules += modules

        for m in all_modules:
            load_symbol(m)
        for m in all_modules:
            load_declaration(m)
        topological_sort()
