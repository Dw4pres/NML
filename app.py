from flask import Flask, render_template_string, make_response
from nml_parse import build_ast, generate_html, NMLParserError, _find_component_root_node
import os
import re

app = Flask(__name__)

# --- Component and Style Management ---
COMPONENTS = {}
GLOBAL_STYLES = {} # This will store our scoped CSS

def load_components():
    """
    Loads and parses the components.nml file on startup.
    This new version also handles @style blocks.
    """
    global COMPONENTS, GLOBAL_STYLES
    COMPONENTS = {}
    GLOBAL_STYLES = {}
    
    try:
        with open('components.nml', 'r') as f:
            nml_text = f.read()
    except FileNotFoundError:
        print("WARNING: components.nml not found. No components will be loaded.")
        return
    except Exception as e:
        print(f"Error reading components.nml: {e}")
        return

    try:
        # We pass GLOBAL_STYLES dict to be populated by the parser
        build_ast(nml_text, components=COMPONENTS, global_styles=GLOBAL_STYLES)
        
        # --- NEW: Post-process components to add their base classes ---
        # This is where we add `.pixel-button` to the <button> tag
        for name, ast in COMPONENTS.items():
            root_node = _find_component_root_node(ast)
            if not root_node:
                continue
            
            # Find the first class in the component's own style block
            # This is a bit of a hack, but it works for our simple case.
            # We look for the first `.class-name` in the global style entry.
            first_class = None
            for scope_id, style_content in GLOBAL_STYLES.items():
                if root_node.get("attributes", {}).get(scope_id):
                    match = re.search(r'\.([\w-]+)\[', style_content)
                    if match:
                        first_class = match.group(1)
                        break
            
            if first_class:
                # Add this class to the root node's attributes
                current_classes = root_node.get("attributes", {}).get("class", "")
                if first_class not in current_classes:
                    root_node["attributes"]["class"] = f"{first_class} {current_classes}".strip()

        print(f"Successfully loaded {len(COMPONENTS)} components.")
        if GLOBAL_STYLES:
            print(f"Processed {len(GLOBAL_STYLES)} scoped style blocks.")
            
    except NMLParserError as e:
        print(f"--- NML Syntax Error in components.nml ---")
        print(f"{e}")
        print("--------------------------------------------")
    except Exception as e:
        print(f"An unexpected error occurred during component loading: {e}")


# --- THIS IS THE FIX ---
# We call this *once* at the top level.
# This ensures it runs in the worker process, not just the reloader.
load_components()


def render_nml_template(template_name, **context):
    """
    Our main NML template renderer.
    It now also injects all loaded component styles.
    """
    template_path = os.path.join('templates', template_name)
    
    try:
        with open(template_path, 'r') as f:
            nml_text = f.read()
    except FileNotFoundError:
        return f"Error: Template '{template_name}' not found.", 404
    except Exception as e:
        return f"Error reading template: {e}", 500

    try:
        # We pass a *copy* of the components dict
        ast = build_ast(nml_text, components=COMPONENTS.copy())
        
        # We pass the context to generate_html!
        html_output = generate_html(ast, context=context)
        
        # --- NEW: Inject Scoped CSS ---
        if GLOBAL_STYLES:
            all_styles = "\n".join(GLOBAL_STYLES.values())
            style_tag = f"<style data-nml-scoped-styles>\n{all_styles}\n</style>"
            
            # Inject just before the closing </head> tag
            if "</head>" in html_output:
                html_output = html_output.replace("</head>", f"{style_tag}\n</head>", 1)
            else:
                # Fallback: just append to the start (for simple tests)
                html_output = style_tag + html_output
                
        return render_template_string(html_output)
        
    except NMLParserError as e:
        # Return the user-friendly error to the browser
        return f"<pre>--- NML Syntax Error ---<br>{e}</pre>", 500
    except Exception as e:
        # print(f"An unexpected error occurred: {e}", file=sys.stderr)
        return f"An unexpected error occurred: {e}", 500

# --- Routes ---
@app.route('/')
def home():
    # Pass data into our template
    context = {
        "username": "NML Developer"
    }
    return render_nml_template('index.nml', **context)

@app.route('/login')
def login():
    # This page doesn't need context, so we pass an empty dict
    return render_nml_template('login-page.nml')

if __name__ == '__main__':
    # We no longer call load_components() here
    print("--- NML-Simple-Server Running ---")
    print("Access your pages at:")
    print("Home:   http://localhost:5173")
    print("Login:  http://localhost:5173/login")
    print("-----------------------------------")
    print("Watching for file changes... (Press CTRL+C to stop)")
    # We add `use_reloader=True` to watch for file changes,
    # but `reloader_type="stat"` is a simple way to do it.
    # Flask's reloader will also reload if components.nml changes!
    app.run(host='192.168.1.29', port=5173, debug=True, use_reloader=True)