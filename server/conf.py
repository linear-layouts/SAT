# Configuration file for the Sphinx documentation builder.
#
# This file only contains a selection of the most common options. For a full
# list see the documentation:
# http://www.sphinx-doc.org/en/master/config

# -- Path setup --------------------------------------------------------------

# If extensions (or modules to document with autodoc) are in another directory,
# add these directories to sys.path here. If the directory is relative to the
# documentation root, use os.path.abspath to make it absolute, like shown here.
#
import os
import sys

sys.path.insert(0, os.path.abspath('.'))

# -- Project information -----------------------------------------------------

project = 'On linear layouts of graphs with SAT'
copyright = '2019, Mirco Haug'
author = 'Mirco Haug'

# The full version, including alpha/beta/rc tags
release = '1.0.0'

# -- General configuration ---------------------------------------------------

# Add any Sphinx extension module names here, as strings. They can be
# extensions coming with Sphinx (named 'sphinx.ext.*') or your custom
# ones.
extensions = [
    'sphinx.ext.autodoc',
    'sphinxcontrib.plantuml',
    'sphinxcontrib.bibtex',
]

# Add any paths that contain templates here, relative to this directory.
templates_path = ['docs/_templates']

# List of patterns, relative to source directory, that match files and
# directories to ignore when looking for source files.
# This pattern also affects html_static_path and html_extra_path.
exclude_patterns = []

# -- Options for HTML output -------------------------------------------------

# The theme to use for HTML and HTML Help pages.  See the documentation for
# a list of builtin themes.
#
html_theme = 'alabaster'

# Add any paths that contain custom static files (such as style sheets) here,
# relative to this directory. They are copied after the builtin static files,
# so a file named "default.css" will overwrite the builtin "default.css".
html_static_path = ['docs/_static']

numfig = True

# -- Extension configuration -------------------------------------------------


latex_elements = {
    # makes the settings from the template
    'preamble': """
\\textwidth 14cm
\\textheight 22cm
\\topmargin 0.0cm
\\evensidemargin 1cm
\\oddsidemargin 1cm
\\setlength\parindent{20pt}
    """,
    # makes the title page
    'maketitle': """
\\begin{titlepage}
	\makeatletter
	\\begin{center}
		{\LARGE Eberhard Karls Universität Tübingen}\\\\
{\large Mathematisch-Naturwissenschaftliche Fakultät \\\\
Wilhelm-Schickard-Institut für Informatik\\\\[4cm]}
		{\huge Forschungsarbeit Informatik MSc.\\\\[2cm]}
		{\Large\\bf  \@title \\\\[1.5cm]}
		{\large \@author }\\\\[0.5cm]
		\@date\\\\[4cm]
		{\small\\bf Reviewers}\\\\[0.5cm]
		\parbox{7cm}
		{\\begin{center}{\large 	Michael A. Bekos}\\\\
(Informatik)\\\\
{\\footnotesize 
					Wilhelm-Schickard-Institut für Informatik\\\\
Universität Tübingen
				}\end{center}}\hfill\parbox{7cm}
			{\\begin{center}
				{\large Michael Kaufmann}\\\\
(Informatik)\\\\
{\\footnotesize 
					Wilhelm-Schickard-Institut für Informatik\\\\
Universität Tübingen
			}\end{center}
		}
	\end{center}
\makeatother
\end{titlepage}

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%%% Titelr"uckseite: Bibliographische Angaben
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

\\thispagestyle{empty}
\\makeatletter
\\vspace*{\\fill}
\\begin{minipage}{11.2cm}
\\textbf{\@author:}\\\\
\\emph{\@title}\\\\ Forschungsarbeit Informatik MSc.\\\\
Eberhard Karls Universität Tübingen\\\\
Thesis period: April 2019 - July 2019
\\end{minipage}
\\makeatother
\\newpage
    """,
    # removes fancy chapter headings
    'fncychap': '',
    # table of contents are created inside the document
    'tableofcontents': '',
    # document class options
    'pointsize': 'twoside,14pt',
    'papersize': 'a4paper',
    # reset the title and link colors back to black
    'sphinxsetup': 'TitleColor={rgb}{0.,0.,0.}, InnerLinkColor={rgb}{0.,0.,0.}',
    # no index of python modules at the end
    'printindex': ''
}

# root document
master_doc = 'docs/index'
latex_documents = [
    # root doc,   output doc,                       title, author, latex documentclass
    (master_doc, 'Researchproject_Mirco_Haug.tex', project, author, 'report')
]

# no index of python classes at the end
latex_domain_indices = False
