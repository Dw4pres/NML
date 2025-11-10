import sys
from my_parser import build_ast, generate_html, NMLParserError # Import our custom error

def compile_file(input_file_path, output_file_path):
    """
    Reads a .nml file, parses it, and writes the compiled HTML
    to the output file.
    """
    try:
        with open(input_file_path, 'r') as f:
            nml_text = f.read()
    except FileNotFoundError:
        print(f"Error: Input file not found at '{input_file_path}'")
        sys.exit(1)
    except Exception as e:
        print(f"Error reading input file: {e}")
        sys.exit(1)

    # Use your proven functions to build the AST and generate HTML
    try:
        ast = build_ast(nml_text)
        html_output = generate_html(ast)
    except NMLParserError as e: # Catch our specific error
        print(f"--- NML Syntax Error ---")
        print(f"{e}") # This will print the user-friendly message
        sys.exit(1)
    except Exception as e: # Catch all other unexpected errors
        print(f"An unexpected error occurred during compilation: {e}")
        print(f"Please check your {input_file_path} file for syntax errors.")
        sys.exit(1)

    try:
        with open(output_file_path, 'w') as f:
            f.write(html_output)
    except Exception as e:
        print(f"Error writing output file: {e}")
        sys.exit(1)

    print(f"Success! Compiled '{input_file_path}' to '{output_file_path}'")

if __name__ == "__main__":
    # This script expects exactly two command-line arguments:
    # python main.py <input_file> <output_file>
    
    if len(sys.argv) != 3:
        print("Usage: python main.py <input_file.nml> <output_file.html>")
        sys.exit(1) # Exit with a non-zero status code to indicate an error
        
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    
    compile_file(input_file, output_file)