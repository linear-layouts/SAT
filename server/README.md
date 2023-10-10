# Linear Layout SAT solver

On linear layouts of graphs with SAT

The full documentation is checked in [here](docs/Researchproject_Mirco_Haug.pdf)

## Development

This application requires lingeling which depends on UNIX. This files assumes that you run in an UNIX like environment. Currently it also seems to work as well in the Windows Subsystem for Linux.

### Init project workspace

First install python 3.10, pip, pipenv

```bash
sudo apt update
sudo apt install -y python3.10 python3-pip              # installs the tools to run the application 
echo "export PATH=\"~/.local/bin:\$PATH\"" >> ~/.bashrc # add pip installed binaries to path
pip3 install pipenv                                     # installs pipenv
exec bash                                               # load the new PATH variable
python3 --version                                       # should show at least python 3.6 or higher
pipenv --version                                        # should show something like pipenv, version 2018.11.26

```

Second build lingeling. You can skip this if you have lingeling already in your path. Check this by running `lingeling --version`
```bash
sudo apt install -y gcc make                            # install the tools to build lingeling
git clone https://github.com/arminbiere/lingeling.git   # checkout the lingeling repo
cd lingeling                                            # change to the checked out repository
./configure.sh && make                                  # con figure and build lingeling
echo "export PATH=\"$(pwd):\$PATH\"" >> ~/.bashrc       # add the current folder to the PATH
exec bash                                               # load the new PATH variable
lingeling --version                                     # should show something like bcj 78ebb8672540bde0a335aea946bbf32515157d5a
```

Set the default Python version

Check what python versions are available on your systems:

```
ls /usr/bin/python*
```

To know whether any version is configured as python alternatives or not. For that run:

```
sudo update-alternatives --list python
```

If the output is:

```
update-alternatives: error: no alternatives for python
```

Then it means there are no alternatives that have been configured, hence let’s do some.

Here we are setting up two versions as alternatives, later we will be able to choose between them to set one of them as the system default one.

```
sudo update-alternatives --install /usr/bin/python python /usr/bin/python3.10 1
```

Switch the default Python version 

```
sudo update-alternatives --config python
```

When you check the version of Python this time, you will have 3.10. For that use:

```
python -V
```

In order to install the necessary packages to run this application run the following commands in the same directory as this README.md file.

```
bash
pipenv install          # install new dependencies from pipfile
pipenv clean            # remove unused dependencies
```

### Build documentation

run `sudo apt install graphviz plantuml` to install the runtime requirements which are not installable via pip.

run `pipenv install -d` to install all the development dependencies including sphinx etc.

`make html` in the root directory generates the sphinx documentation and outputs it at build/docs

### Run

#### Production

1. Get the sources to the target server
    1. Either by checking out this repository on the target server via `git clone https://github.com/linear-layouts/SAT.git && cd SAT/server`
    1. Or by copying the relevant files directly to the target server. e.g via:
    
         ```bash
        rsync -av * --include 'be/*.py' --include '*/'  --include 'Pipfile*' --include '*.md' --include '*.py'  --exclude '*' mirco@sofa.fsi.uni-tuebingen.de:/home/mirco/book-embedding/
        ```
1. Optionally enter the screen session via   `screen -r sat-server`
1. Stop the old server process
1. Start the new server process via
    ```bash
    pipenv run waitress-serve --listen=*:5555 be.app:app
    ```
1. optionally exit the screen session via `CTRL + a` `CTRL + d`
_Side note:_

regularly backup the database file `data.db`

#### Note

For python >3.8, there is a runtime error related to cached_property or to collections, when starting the server for first time. To resolve these issue add the following lines to the file mentioned in the error (path_to_python/werkzeug/__init__.py):

```bash
from werkzeug.utils import cached_property
```


```bash
import collections
from collections import abc
collections.Mapping = abc.Mapping
collections.Hashable = abc.Hashable
collections.MutableMapping = abc.MutableMapping
collections.Iterable = abc.Iterable
```
