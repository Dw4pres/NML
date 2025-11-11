from flask import Flask, render_template_string
from nml_parse import build_ast, generate_html, NMLParserError, _find_component_root_node
import os
import re

app = Flask(__name__)

# --- Component and Style Management ---
COMPONENTS = {}
GLOBAL_STYLES = {} # This will store our scoped CSS

COMPONENTS_FILE = 'components.nml'
LAST_COMPONENTS_MTIME = None

def maybe_reload_components():
    global LAST_COMPONENTS_MTIME
    try:
        mtime = os.path.getmtime(COMPONENTS_FILE)
    except OSError:
        mtime = None
    if mtime is not None and mtime != LAST_COMPONENTS_MTIME:
        load_components()

# --- Routing helpers (Phase 5.1) ---
def resolve_template_path(req_path: str, base_dir: str = 'templates') -> tuple[str | None, dict]:
    """
    Resolve a URL path to a template name relative to base_dir and params.
    Rules:
    - '/' -> 'index.nml' if exists
    - '/a/b' -> 'a/b.nml' if exists
    - '/a/b/' -> 'a/b/index.nml' if exists
    - Dynamic last segment: '/a/123' -> 'a/[id].nml' if such a file exists; returns {'id': '123'}
    Returns (template_name, params) or (None, {}).
    """
    # Normalize
    path = req_path.strip('/')
    # Root
    if path == "":
        index_path = os.path.join(base_dir, 'index.nml')
        if os.path.exists(index_path):
            return ('index.nml', {})
        return (None, {})

    segments = path.split('/')
    # 1) Direct file
    direct_rel = os.path.join(*segments) + '.nml'
    direct_abs = os.path.join(base_dir, direct_rel)
    if os.path.exists(direct_abs):
        return (direct_rel.replace('\\', '/'), {})
    # 2) Directory index
    dir_abs = os.path.join(base_dir, *segments)
    index_abs = os.path.join(dir_abs, 'index.nml')
    if os.path.isdir(dir_abs) and os.path.exists(index_abs):
        rel = os.path.join(*segments, 'index.nml')
        return (rel.replace('\\', '/'), {})
    # 3) Dynamic last segment [param].nml in parent dir
    if len(segments) >= 1:
        parent_abs = os.path.join(base_dir, *segments[:-1]) if len(segments) > 1 else base_dir
        last = segments[-1]
        try:
            for fname in os.listdir(parent_abs):
                # match [name].nml
                if fname.startswith('[') and fname.endswith('].nml') and os.path.isfile(os.path.join(parent_abs, fname)):
                    param = fname[1:-5]  # strip '[' and '].nml'
                    rel = os.path.join(*(segments[:-1] + [fname]))
                    return (rel.replace('\\', '/'), {param: last})
        except FileNotFoundError:
            pass
    return (None, {})

def load_components():
    """
    Loads and parses the components.nml file on startup.
    This new version also handles @style blocks.
    """
    global COMPONENTS, GLOBAL_STYLES, LAST_COMPONENTS_MTIME
    COMPONENTS = {}
    GLOBAL_STYLES = {}
    
    try:
        with open(COMPONENTS_FILE, 'r') as f:
            nml_text = f.read()
        LAST_COMPONENTS_MTIME = os.path.getmtime(COMPONENTS_FILE)
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

# We call this *once* at the top level.
# This ensures it runs in the worker process, not just the reloader.
load_components()


def render_nml_template(template_name, **context):
    """
    Our main NML template renderer.
    It now also injects all loaded component styles.
    """
    maybe_reload_components()
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
        
        # --- NEW: Inject Scoped CSS (only used components) ---
        def _collect_scope_ids(nodes):
            ids = set()
            def walk(items):
                for n in items:
                    attrs = n.get("attributes", {})
                    for k in attrs.keys():
                        if isinstance(k, str) and k.startswith("nml-c-"):
                            ids.add(k)
                    if n.get("children"):
                        walk(n["children"])
            walk(nodes)
            return ids

        used_ids = _collect_scope_ids(ast)
        if used_ids:
            used_styles = [GLOBAL_STYLES[sid] for sid in used_ids if sid in GLOBAL_STYLES]
            if used_styles:
                all_styles = "\n".join(used_styles)
                style_tag = f"<style data-nml-scoped-styles>\n{all_styles}\n</style>"
                if "</head>" in html_output:
                    html_output = html_output.replace("</head>", f"{style_tag}\n</head>", 1)
                else:
                    html_output = style_tag + html_output
                
        return render_template_string(html_output)
        
    except NMLParserError as e:
        # Return the user-friendly error to the browser
        return f"<pre>--- NML Syntax Error ---<br>{e}</pre>", 500
    except Exception as e:
        # print(f"An unexpected error occurred: {e}", file=sys.stderr)
        return f"An unexpected error occurred: {e}", 500

# --- Routes ---
@app.route('/', defaults={'req_path': ''})
@app.route('/<path:req_path>')
def serve(req_path: str):
    (template_rel, params) = resolve_template_path(req_path)
    if not template_rel:
        # Try a 404 template if present
        not_found_rel, _ = (('404.nml', {}) if os.path.exists(os.path.join('templates', '404.nml')) else (None, {}))
        if not_found_rel:
            return render_nml_template(not_found_rel, path='/' + req_path)
        return (f"Not found: /{req_path}", 404)
    return render_nml_template(template_rel, **params)

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
    app.run(host='127.0.0.1', port=5173, debug=True, use_reloader=True)