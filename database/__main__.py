import logging
import os

import dotenv
import jixia

from . import main

dotenv.load_dotenv()
logging.basicConfig(
    filename=os.environ.get("LOG_FILENAME") or None,
    filemode=os.environ.get("LOG_FILEMODE", "a"),
    level=os.environ.get("LOG_LEVEL", "INFO"),
)
# Only the `jixia` subcommand shells out to the analyzer binary. Requiring this
# at import time breaks `schema`, `informal`, and `vector-db`, which never touch
# it; that subcommand validates the variable itself.
if os.environ.get("JIXIA_PATH"):
    jixia.run.executable = os.environ["JIXIA_PATH"]

main()
