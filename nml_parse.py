import re
import copy # Needed for deep copying component ASTs
import uuid # For generating unique scope IDs

# --- Custom Error for User-Friendly Feedback ---
class NMLParserError(Exception):
    """Custom exception for parsing errors in NML."""
    pass

# --- Constants ---
INDENT_WIDTH = 4
VOID_ELEMENTS = {"meta", "link", "input", "img", "br", "hr"}
KNOWN_BOOLEAN_ATTRIBUTES = {"crossorigin", "disabled", "readonly", "checked", "selected", "autoplay", "controls", "loop", "muted", "playsinline", "required"}

# --- Variable Rendering Helper ---
def _render_variables(text: str, context: dict) -> str:
    """Replaces {{ var }} placeholders with values from the context."""
    if context is None:
        return text
        
    def replacer(match):
        key = match.group(1)
        # Return the value, or the original tag if not found
        return str(context.get(key, f"{{{{ {key} }}}}"))

    return re.sub(r"{{\s*(.*?)\s*}}", replacer, text)

# --- Attribute Merging Helper ---
def _merge_attributes(base_attrs: dict, override_attrs: dict) -> dict:
    """
    Implements our "Hybrid Merge" logic.
    - Merges 'class'
    - Overrides all other attributes
    """
    # Start with a copy of the base attributes
    merged = base_attrs.copy()
    
    for key, override_value in override_attrs.items():
        if key == "class":
            # --- Rule 2: Explicit Override ---
            # If the override value came from .class("..."), it's a string.
            # We replace the base class entirely.
            if isinstance(override_value, str):
                merged["class"] = override_value
            
            # --- Rule 1: Smart Append ---
            # If it came from dot-chain syntax, it's a list.
            # We append the new classes.
            elif isinstance(override_value, list):
                base_class_list = merged.get("class", "").split()
                # Filter out empty strings that might result from .split()
                base_class_list = [c for c in base_class_list if c]
                new_class_list = base_class_list + override_value
                merged["class"] = " ".join(new_class_list)
        else:
            # For all other attributes, the override wins
            merged[key] = override_value
            
    return merged

# --- Slot Injection Helper ---
def _inject_slot(component_ast: list[dict], slot_content: list[dict]) -> list[dict]:
    """
    Recursively finds the @slot node in a component's AST
    and replaces it with the slot_content (the children).
    """
    injected_ast = []
    for node in component_ast:
        if node.get("element") == "@slot":
            # Found the slot! Inject the content and stop.
            injected_ast.extend(slot_content)
        else:
            # Not a slot, so keep the node
            new_node = node.copy() # Shallow copy is fine
            if new_node.get("children"):
                # Recurse to find slots in children
                new_node["children"] = _inject_slot(new_node["children"], slot_content)
            injected_ast.append(new_node)
    return injected_ast
    
# --- NEW: Scoped CSS Helper ---
def _find_component_root_node(ast: list[dict]) -> dict | None:
    """Finds the first valid, non-special element to be the root."""
    for node in ast:
        if node.get("element") not in ["@define", "@slot", "__text__", "@style", "doctype"]:
            return node
    return None

def _extract_scoped_style(ast: list[dict], scope_id: str) -> (list[dict], str):
    """
    Finds the first @style: block, extracts its content,
    and returns the AST *without* the style block.
    """
    clean_ast = []
    scoped_css = ""
    style_node_found = False

    for node in ast:
        if not style_node_found and node.get("element") == "@style":
            style_node_found = True
            raw_css = "\n".join(node.get("multiline_content", []))
            
            # This is where we rewrite the CSS selectors
            def replacer(match):
                selector = match.group(1).strip()
                # Add the scope ID to every selector
                # e.g., .my-class -> .my-class[nml-c-12345]
                # e.g., .my-class:hover -> .my-class[nml-c-12345]:hover
                
                # Split selector by pseudo-classes/elements
                parts = re.split(r'(:[:\w-]+)', selector, maxsplit=1)
                base_selector = parts[0]
                pseudo = "".join(parts[1:])
                
                return f"{base_selector}[{scope_id}]{pseudo} {{"
            
            # Simple regex to find selectors. This is basic
            # and could be improved, but works for simple cases.
            scoped_css = re.sub(r'([\w\.-]+(?:[:\w-]*))\s*\{', replacer, raw_css)
        else:
            clean_ast.append(node)
            
    return clean_ast, scoped_css


# --- Core Parser Functions ---

def parse_line(line: str) -> dict | None:
    """
    Parses a single line of NML into a structured dictionary.
    Now handles:
    - Standard elements (div.class("..."))
    - Component definitions (@define.PixelButton)
    - Component calls (@PixelButton.!text-2xl)
    - Content pipes (| Text)
    - **NEW: @style: blocks**
    """
    line = line.strip()
    if not line:
        return None

    # --- 1. Handle Special Syntax ---
    
    # Handle Content Pipe (|)
    if line.startswith("|"):
        return {
            "element": "__text__", "content": line[1:].strip(),
            "attributes": {}, "children": [], "multiline_trigger": False, "multiline_content": []
        }
        
    # Handle Component Definition (@define.)
    if line.startswith("@define."):
        component_name = line[8:].strip()
        if not component_name:
            return None # Invalid syntax
        return {
            "element": "@define", "attributes": {"class": component_name}, # Use 'class' to store the name
            "content": "", "children": [], "multiline_trigger": False, "multiline_content": []
        }
        
    # Handle Component Slot (@slot)
    if line == "@slot":
        return {
            "element": "@slot", "attributes": {}, "content": "", "children": [],
            "multiline_trigger": False, "multiline_content": []
        }
        
    # --- NEW: Handle @style: ---
    if line == "@style:":
        return {
            "element": "@style", "attributes": {}, "content": "", "children": [],
            "multiline_trigger": True, "multiline_content": []
        }
        
    # Handle Component Call (@)
    is_component_call = False
    if line.startswith("@"):
        is_component_call = True
        line = line[1:] # Treat the rest just like a normal element

    # --- 2. Handle Element/Attribute Parsing ---
    
    # Check for multiline trigger (:)
    multiline_trigger = False
    if line.endswith(':'):
        multiline_trigger = True
        line = line[:-1].rstrip() # Remove the colon

    # Use regex to split on '.' ONLY if it's not inside quotes
    parts = re.split(r'\.(?=(?:[^"]*"[^"]*")*[^"]*$)', line)
    
    if not parts[0] and len(parts) > 1:
        element = parts[1]
        parts = parts[1:] # Consume the element part
    else:
        element = parts[0]
        
    attributes = {}
    content_args = []
    
    element_match = re.match(r'([\w-]+)\((.*)\)$', element)
    if element_match:
        element = element_match.group(1)
        args_str = element_match.group(2)
        parsed_args = re.findall(r'"(.*?)"', args_str)
        content_args.extend(parsed_args)
    
    dot_chain_classes = [] 

    for part in parts[1:]:
        if not part: continue 

        match = re.match(r'([\w-]+)\((.*)\)$', part)
        if match:
            attr_name = match.group(1)
            args_str = match.group(2)
            parsed_args = re.findall(r'"(.*?)"', args_str)
            
            if attr_name == "class":
                if parsed_args:
                    attributes["class"] = parsed_args[0]
                    content_args.extend(parsed_args[1:])
                else:
                    attributes["class"] = ""
            else:
                if parsed_args:
                    attributes[attr_name] = parsed_args[0]
                    content_args.extend(parsed_args[1:])
        else:
            if part in KNOWN_BOOLEAN_ATTRIBUTES:
                attributes[part] = True
            else:
                dot_chain_classes.append(part)

    if dot_chain_classes:
        if is_component_call:
            attributes["class"] = dot_chain_classes
        else:
            existing_class = attributes.get("class", "")
            new_classes = " ".join(dot_chain_classes)
            attributes["class"] = f"{existing_class} {new_classes}".strip()

    return {
        "element": "@" + element if is_component_call else element,
        "attributes": attributes,
        "content": " ".join(content_args),
        "children": [],
        "multiline_trigger": multiline_trigger,
        "multiline_content": []
    }

def build_ast(text: str, components: dict = None, global_styles: dict = None) -> list[dict]:
    """
    Parses a full multi-line, indented NML string into an Abstract Syntax Tree (AST).
    
    This function is now responsible for:
    - Handling indentation and tree building
    - Handling multiline content (style: and @style:)
    - Handling comments (//)
    - Handling content pipes (|)
    - Throwing user-friendly NMLParserError
    - **NEW: Expanding components (@PixelButton) using the components dict**
    - **NEW: Accepting global_styles dict to populate**
    """
    if components is None:
        components = {}
    
    # global_styles is mutable, so we must check it this way
    # It will be passed in by `load_components` to be filled.
    if global_styles is None:
        global_styles = {}
        
    root = {"element": "root", "children": [], "attributes": {}, "content": ""}
    stack = [(root, -1)]
    lines = text.split('\n')
    line_number = 0
    
    while line_number < len(lines):
        line = lines[line_number]
        line_number += 1
        
        stripped_line = line.strip()

        if not stripped_line or stripped_line.startswith("//"):
            continue
            
        if line and line[0] == '\t':
            raise NMLParserError(f"Indentation error on line {line_number}: Please use 4 spaces for indentation, not tabs.")
            
        leading_spaces = len(line) - len(line.lstrip(' '))
        if leading_spaces % INDENT_WIDTH != 0:
            raise NMLParserError(f"Indentation error on line {line_number}: Non-standard indentation. Use {INDENT_WIDTH} spaces per level.")
        
        level = leading_spaces // INDENT_WIDTH
        
        new_node = parse_line(line)
        if not new_node:
            continue

        current_level = stack[-1][1]
        
        # --- THIS IS THE FIX (Bug 1: Mixed Content Pipe) ---
        # 1. Pop the stack FIRST to find the correct parent
        if level > current_level + 1:
            raise NMLParserError(f"Indentation error on line {line_number}: Incorrect indentation level (too deep).")

        while level <= current_level:
            stack.pop()
            current_level = stack[-1][1] # Get the new, correct parent's level

        # 2. Now that we're at the correct parent, get it from the stack.
        parent_node = stack[-1][0]

        # 3. Now, handle the new node
        if new_node["element"] == "__text__":
            # A content pipe's level must be 1 level deeper than its *actual* parent
            # AND it cannot be a child of the root (where current_level == -1)
            if level != current_level + 1 or current_level == -1:
                raise NMLParserError(f"Indentation error on line {line_number}: Content pipe '|' must be indented one level deeper than its parent element.")
            
            # Add text node to the correct parent
            parent_node["children"].append(new_node)
            continue # Don't add text nodes to the stack
            
        # 4. If it's a regular element, add it to the parent and the stack
        parent_node["children"].append(new_node)
        stack.append((new_node, level)) # Add new node to the stack

        # 8. Handle Multiline Content (:)
        if new_node["multiline_trigger"]:
            multiline_start_level = level + 1
            while line_number < len(lines):
                line = lines[line_number]
                stripped_line = line.strip()

                if not stripped_line:
                    new_node["multiline_content"].append("")
                    line_number += 1
                    continue
                
                multiline_spaces = len(line) - len(line.lstrip(' '))
                
                if multiline_spaces < multiline_start_level * INDENT_WIDTH:
                    break
                    
                if multiline_spaces % INDENT_WIDTH != 0:
                    raise NMLParserError(f"Indentation error on line {line_number}: Non-standard indentation in multiline content block.")
                
                relative_indent = " " * (multiline_spaces - (multiline_start_level * INDENT_WIDTH))
                new_node["multiline_content"].append(relative_indent + stripped_line)
                line_number += 1
            
            stack.pop() # Pop the multiline node, it can't have children

    # --- COMPONENT EXPANSION PASS ---
    root["children"] = _expand_components_pass(root["children"], components, global_styles)

    return root["children"]

def _expand_components_pass(ast: list[dict], components: dict, global_styles: dict) -> list[dict]:
    """
    Recursively walks the AST, finds component calls (@),
    and replaces them with the expanded component AST.
    
    **NEW: Also populates the global_styles dict.**
    """
    expanded_ast = []
    
    for node in ast:
        element = node.get("element")
        
        if element == "@define":
            component_name = node.get("attributes", {}).get("class")
            if component_name:
                # --- NEW: Process for @style ---
                scope_id = f"nml-c-{uuid.uuid4().hex[:6]}"
                
                # 1. Extract the style, get back the cleaned AST
                component_ast, scoped_css = _extract_scoped_style(node.get("children", []), scope_id)
                
                # 2. If CSS was found, add it to global styles and scope the root
                if scoped_css:
                    global_styles[scope_id] = scoped_css
                    root_node = _find_component_root_node(component_ast)
                    if root_node:
                        # Add the scope ID to the root element's attributes
                        root_node["attributes"][scope_id] = True
                
                # 3. Store the cleaned AST (without @style)
                components[component_name] = component_ast
            continue # Don't add @define blocks to the final tree

        if element and element.startswith("@"):
            component_name = element[1:]
            
            if component_name in components:
                component_template_ast = copy.deepcopy(components[component_name])
                
                slot_content = _expand_components_pass(node.get("children", []), components, global_styles)
                
                injected_ast = _inject_slot(component_template_ast, slot_content)
                
                if injected_ast:
                    base_node = injected_ast[0]
                    base_attrs = base_node.get("attributes", {})
                    override_attrs = node.get("attributes", {})
                    base_node["attributes"] = _merge_attributes(base_attrs, override_attrs)
                
                expanded_ast.extend(injected_ast)
                
            elif element not in ["@define", "@slot", "@style"]:
                raise NMLParserError(f"Undefined component: '@{component_name}' not found.")
        
        else:
            if node.get("children"):
                node["children"] = _expand_components_pass(node["children"], components, global_styles)
            
            expanded_ast.append(node)
            
    return expanded_ast


def generate_html(ast: list[dict], indent_level: int = 0, context: dict = None) -> str:
    """
    Recursively walks the final, expanded AST and generates an HTML string.
    Now also applies context (variables).
    """
    if context is None:
        context = {}
        
    html = ""
    indent = " " * (indent_level * INDENT_WIDTH)

    for node in ast:
        if node["element"] == "__text__":
            html += f"{indent}{_render_variables(node.get('content', ''), context)}\n"
            continue
            
        if node["element"] in ["@define", "@slot", "@style"]:
            continue

        tag = node.get("element") 
        if tag == "doctype":
            if node.get("attributes", {}).get("class") == "html":
                html += f"{indent}<!DOCTYPE html>\n"
            continue
        
        attr_string = ""
        for key, value in node.get("attributes", {}).items():
            if value is True:
                attr_string += f" {key}" # Boolean attribute
            else:
                rendered_value = _render_variables(str(value), context)
                attr_string += f' {key}="{rendered_value}"'
        
        html += f"{indent}<{tag}{attr_string}"
        
        content = _render_variables(node.get("content", ""), context)
        children = node.get("children", [])
        multiline = node.get("multiline_content", [])
        
        if tag in VOID_ELEMENTS:
            html += ">\n"
            continue
        
        html += ">"
        
        if content:
            html += content
        elif children:
            html += "\n"
            html += generate_html(children, indent_level + 1, context)
            html += f"{indent}"
        elif multiline:
            html += "\n"
            for line in multiline:
                html += f"{indent}    {_render_variables(line, context)}\n"
            html += f"{indent}"

        html += f"</{tag}>\n"
    
    return html.strip() if indent_level == 0 else html