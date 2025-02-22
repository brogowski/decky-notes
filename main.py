import logging
import logging.handlers
import os
import subprocess
import base64
import tempfile
import glob
import shutil
import stat
import pwd
from pathlib import Path
from datetime import datetime

formatter = logging.Formatter('%(asctime)s %(levelname)s %(message)s')
handler = logging.handlers.RotatingFileHandler("/tmp/decky-notes.log", maxBytes=1024*1024, backupCount=8)
handler.setFormatter(formatter)
logger = logging.getLogger()
logger.addHandler(handler)
logger.setLevel(logging.INFO)

class Plugin:
    def __encode_image(self, image_bytes):
        return base64.b64encode(image_bytes).decode("ascii")

    async def save_image(self, image, file_name):
        image_bytes = base64.b64decode(image)
        full_path = os.path.join(self.images_dir, file_name)
        dir = os.path.dirname(full_path)
        if not os.path.exists(dir):
            os.makedirs(dir)
        with open(full_path, 'ab') as file:
            file.write(image_bytes)
        logger.info("New screenshot at: " + full_path)
        return full_path
    
    async def list_images(self):
        return [*map(lambda x : os.path.basename(x), glob.glob(self.images_dir + "/*.*"))]
    
    async def get_image(self, file_name):
        full_path = os.path.join(self.images_dir, file_name)
        with open(full_path, mode='rb') as file:
            fileContent = file.read()
        return self.__encode_image(self, fileContent)
    
    async def delete_image(self, file_name):
        full_path = os.path.join(self.images_dir, file_name)
        os.remove(full_path)

    async def _main(self):
        logger.info("Load decky notes")

        self.plugin_dir = str(Path(__file__).resolve().parent)
        user_name = subprocess.check_output("who | awk '{print $1}' | sort | head -1", shell=True).decode().strip()
        home_dir = pwd.getpwnam(user_name).pw_dir
        self.images_dir = os.path.join(home_dir, "Pictures/decky-notes")

        logger.info("Running as: " + user_name)
        logger.info("Plugin dir: " + self.plugin_dir)
        logger.info("Images dir: " + self.images_dir)

        os.makedirs(self.images_dir, exist_ok=True)
    
    async def _unload(self):
        logger.info("Unload decky notes")