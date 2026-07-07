import os
from argparse import ArgumentParser

import psycopg
from jixia import LeanProject
from jixia.structs import parse_name

from .informalize import generate_informal
from .jixia_db import load_data
from .vector_db import create_vector_db
from .create_schema import create_schema


def main():
    parser = ArgumentParser()
    subparser = parser.add_subparsers()
    schema_parser = subparser.add_parser("schema")
    schema_parser.set_defaults(command="schema")
    jixia_parser = subparser.add_parser("jixia")
    jixia_parser.set_defaults(command="jixia")
    jixia_parser.add_argument("project_root", help="Project to be indexed")
    jixia_parser.add_argument(
        "prefixes",
        help="Comma-separated list of module prefixes to be included in the index; e.g., Init,Mathlib",
    )
    informal_parser = subparser.add_parser("informal")
    informal_parser.set_defaults(command="informal")
    informal_parser.add_argument("--batch-size", type=int, default=50)
    informal_parser.add_argument(
        "--limit-level",
        type=int,
        help="Limit max level. Used for testing.",
    )
    informal_parser.add_argument(
        "--limit-num-per-level",
        type=int,
        help="Limit max number of items per level. Used for testing.",
    )
    vector_db_parser = subparser.add_parser("vector-db")
    vector_db_parser.set_defaults(command="vector-db")
    vector_db_parser.add_argument("--batch-size", type=int, default=8)

    args = parser.parse_args()

    # The jixia analysis phase can run 30-60+ min with no DB traffic at all.
    # GitHub Actions runners sit behind Azure's outbound NAT, whose default
    # idle timeout (~4 min) silently drops the connection before that phase
    # ends. TCP keepalives (well under 4 min) keep the NAT mapping alive.
    with psycopg.connect(
        os.environ["CONNECTION_STRING"],
        autocommit=True,
        keepalives=1,
        keepalives_idle=30,
        keepalives_interval=10,
        keepalives_count=5,
    ) as conn:
        if args.command == "schema":
            create_schema(conn)
        elif args.command == "jixia":
            # jixia runs each module with cwd=project_root, so the module file
            # path must be absolute — a relative root would be resolved twice.
            project = LeanProject(os.path.abspath(args.project_root))
            prefixes = [parse_name(p) for p in args.prefixes.split(",")]
            load_data(project, prefixes, conn)
        elif args.command == "informal":
            generate_informal(
                conn,
                batch_size=args.batch_size,
                limit_level=args.limit_level,
                limit_num_per_level=args.limit_num_per_level,
            )
        elif args.command == "vector-db":
            create_vector_db(conn, os.environ["CHROMA_PATH"], batch_size=args.batch_size)
