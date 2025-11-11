import sys
import os
import argparse
import json
import time
from nml_parse import build_ast, generate_html, NMLParserError # Import our custom error

def _discover_components_path(explicit_path: str | None) -> str | None:
    """Resolve components.nml path: explicit > nml.config.json > repo default."""
    if explicit_path:
        return explicit_path
    # Try project config in CWD
    cfg_path = os.path.join(os.getcwd(), 'nml.config.json')
    try:
        if os.path.exists(cfg_path):
            with open(cfg_path, 'r') as cf:
                cfg = json.load(cf)
                comp = cfg.get('components')
                if comp:
                    return comp
    except Exception:
        pass
    # Fallback to repo default alongside this file
    default_path = os.path.join(os.path.dirname(__file__), 'components.nml')
    return default_path if os.path.exists(default_path) else None

def compile_file(input_file_path, output_file_path, components_path: str | None = None):
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
        components = {}
        global_styles = {}
        resolved_components_path = _discover_components_path(components_path)
        if resolved_components_path:
            try:
                with open(resolved_components_path, 'r') as cf:
                    components_nml = cf.read()
                build_ast(components_nml, components=components, global_styles=global_styles)
            except FileNotFoundError:
                pass
        ast = build_ast(nml_text, components=components.copy())
        html_output = generate_html(ast)
        if global_styles:
            all_styles = "\n".join(global_styles.values())
            style_tag = f"<style data-nml-scoped-styles>\n{all_styles}\n</style>"
            if "</head>" in html_output:
                html_output = html_output.replace("</head>", f"{style_tag}\n</head>", 1)
            else:
                html_output = style_tag + html_output
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

def cli_main():
    parser = argparse.ArgumentParser(description='Compile NML to HTML')
    parser.add_argument('input', help='Input .nml file')
    parser.add_argument('output', help='Output .html file')
    parser.add_argument('--components', help='Path to components.nml', default=None)
    parser.add_argument('--watch', action='store_true', help='Watch input/components for changes and recompile')
    args = parser.parse_args()
    if not args.watch:
        compile_file(args.input, args.output, components_path=args.components)
        return

    # Simple polling-based watch to keep dependencies minimal
    print('[nmlc] Watching for changes... Press Ctrl+C to stop.')
    comp_path = _discover_components_path(args.components)
    def mtime(p):
        try:
            return os.path.getmtime(p) if p else None
        except OSError:
            return None
    last_in = mtime(args.input)
    last_comp = mtime(comp_path)
    try:
        while True:
            cur_in = mtime(args.input)
            cur_comp = mtime(comp_path)
            if cur_in != last_in or cur_comp != last_comp:
                last_in, last_comp = cur_in, cur_comp
                try:
                    compile_file(args.input, args.output, components_path=args.components)
                except SystemExit:
                    # compile_file already printed an error
                    pass
            time.sleep(0.5)
    except KeyboardInterrupt:
        print('\n[nmlc] Stopped watching.')

if __name__ == "__main__":
    cli_main()