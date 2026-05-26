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
jixia.run.executable = os.environ["JIXIA_PATH"]

main()
