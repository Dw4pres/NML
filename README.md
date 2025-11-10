NML (Not A Markup Language) Compiler

This is a simple command-line tool to compile .nml files into standard .html files.

Prerequisites

Python 3

nml_parse.py (the parser library)

How to Use

Save your custom language code in a file (e.g., mypage.nml).

Open your terminal or command prompt.

Navigate to the directory containing main.py and nml_parse.py.

Run the compiler by passing the input file and desired output file as arguments:

python main.py <input_file.nml> <output_file.html>


Example:

To compile the login-page.nml file:

python main.py login-page.nml login.html


This will create a new file named login.html in the same directory, containing the fully compiled HTML.