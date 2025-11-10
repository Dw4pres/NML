import pytest
import re
from nml_parse import (
    parse_line, 
    build_ast, 
    generate_html, 
    NMLParserError, 
    _render_variables,
    _extract_scoped_style,
    _find_component_root_node
)

# --- Fixtures ---

@pytest.fixture
def full_example_text():
    """
    Provides the full, complex NML example text for integration tests.
    Uses 4-space indentation.
    """
    return (
        "doctype.html\n"
        "html.lang(\"en\").default\n" 
        "    head\n"
        "        meta.charset(\"UTF-8\")\n"
        "        meta.name(\"viewport\").content(\"width=device-width, initial-scale=1.0\")\n"
        "        title(\"Mythic Gridiron - Login\")\n"
        "        // 1. Tailwind CSS\n"
        "        script.src(\"https://cdn.tailwindcss.com\")\n"
        "        // 2. Google Font\n"
        "        link.rel(\"preconnect\").href(\"https://fonts.googleapis.com\")\n"
        "        link.rel(\"preconnect\").href(\"https://fonts.gstatic.com\").crossorigin\n"
        "        link.href(\"https://fonts.googleapis.com/css2?family=VT323&display=swap\").rel(\"stylesheet\")\n"
        "        // 3. Custom Styles\n"
        "        style:\n"
        "            body {\n"
        "                font-family: 'VT323', monospace;\n"
        "                background-color: #0c1524;\n"
        "            }\n"
        "            .pixel-button {\n"
        "                display: block;\n"
        "                width: 100%;\n"
        "            }\n"
        "    body.text-lg\n"
        "        div.class(\"min-h-screen w-full flex flex-col items-center justify-center p-4\")\n"
        "            div.class(\"pixel-box-raised w-full max-w-lg p-6\")\n"
        "                div.class(\"text-center mb-6\")\n"
        "                    h1.class(\"text-5xl text-yellow-300\", \"Sample Header!\")\n"
        "                    p.class(\"text-slate-400 text-2xl\", \"Sample text.\")\n"
    )

@pytest.fixture
def mock_components():
    """
    Provides a mock component dictionary for testing.
    This is now a more complex fixture that simulates the *full*
    component loading process, including style scoping.
    """
    components = {}
    global_styles = {} # This will be populated by build_ast
    
    # 1. Define the PixelBox component
    pixel_box_nml = (
        "@define.PixelBox\n"
        "    div\n" # Root node
        "        @slot\n"
        "    @style:\n"
        "        .pixel-box-raised {\n"
        "            background-color: #1e293b;\n"
        "        }\n"
        "        .pixel-box-inset {\n"
        "            background-color: #0f172a;\n"
        "        }"
    )
    # This call simulates `load_components()`:
    # It parses the NML and populates `components` and `global_styles`
    build_ast(pixel_box_nml, components=components, global_styles=global_styles)

    # 2. Define the PixelButton component
    pixel_button_nml = (
        "@define.PixelButton\n"
        "    button.type(\"button\")\n" # Root node
        "        @slot\n"
        "    @style:\n"
        "        .pixel-button {\n"
        "            display: block;\n"
        "        }\n"
        "        .pixel-button:hover {\n"
        "            background-color: #475569;\n"
        "        }"
    )
    build_ast(pixel_button_nml, components=components, global_styles=global_styles)
    
    # 3. Post-process: Manually add base classes (simulating app.py)
    # This is a bit simplified vs. the regex in app.py, but achieves the same result
    
    # Find PixelBox's root and add 'pixel-box-raised'
    pb_root = _find_component_root_node(components["PixelBox"])
    pb_root["attributes"]["class"] = "pixel-box-raised"
    
    # Find PixelButton's root and add 'pixel-button'
    pbtn_root = _find_component_root_node(components["PixelButton"])
    pbtn_root["attributes"]["class"] = "pixel-button"

    return components


# --- Helper for HTML minification in tests ---
def minify(html):
    """
    A smarter minify that only removes whitespace *between* tags,
    not inside them (which is important for <style> and <pre>).
    """
    html = re.sub(r'>\s+<', '><', html)
    html = re.sub(r'\n\s*', '', html)
    html = re.sub(r'\s+$', '', html)
    return html.strip()

# --- _render_variables Tests ---
def test_render_variables_simple():
    context = {"name": "Alice"}
    assert _render_variables("Hello, {{ name }}!", context) == "Hello, Alice!"

def test_render_variables_multiple():
    context = {"name": "Alice", "role": "admin"}
    assert _render_variables("User: {{ name }}, Role: {{ role }}", context) == "User: Alice, Role: admin"

def test_render_variables_with_spacing():
    context = {"name": "Bob"}
    assert _render_variables("Hello, {{name}}!", context) == "Hello, Bob!"
    assert _render_variables("Hello, {{ name  }}!", context) == "Hello, Bob!"

def test_render_variables_not_found():
    context = {"name": "Alice"}
    # It should return the tag itself if the variable is not in the context
    assert _render_variables("Hello, {{ username }}!", context) == "Hello, {{ username }}!"

def test_render_variables_no_context():
    assert _render_variables("Hello, {{ name }}!", {}) == "Hello, {{ name }}!"


# --- parse_line Tests ---
def test_parse_line_simple_element():
    assert parse_line("body") == {
        "element": "body", "attributes": {}, "content": "", "children": [],
        "multiline_trigger": False, "multiline_content": []
    }

def test_parse_line_with_leading_dot():
    assert parse_line(".div") == {
        "element": "div", "attributes": {}, "content": "", "children": [],
        "multiline_trigger": False, "multiline_content": []
    }

def test_parse_line_one_attribute():
    line = 'body.class("text-lg")'
    assert parse_line(line)["attributes"] == {"class": "text-lg"}

def test_parse_line_multiple_attributes():
    line = 'link.rel("stylesheet").href("https_link_here")'
    assert parse_line(line)["attributes"] == {
        "rel": "stylesheet", "href": "https_link_here"
    }

def test_parse_line_content_only():
    line = 'h1("Hello World")'
    parsed = parse_line(line)
    assert parsed["element"] == "h1"
    assert parsed["content"] == "Hello World"
    assert parsed["attributes"] == {}

def test_parse_line_attributes_and_content():
    line = 'h1.class("title", "Hello World")'
    parsed = parse_line(line)
    assert parsed["element"] == "h1"
    assert parsed["attributes"] == {"class": "title"}
    assert parsed["content"] == "Hello World"

def test_parse_line_handles_dot_in_quotes():
    line = 'a.href("...").class("text-blue", "Click for v1.0")'
    parsed = parse_line(line)
    assert parsed["element"] == "a"
    assert parsed["attributes"] == {"class": "text-blue", "href": "..."}
    assert parsed["content"] == "Click for v1.0"

def test_parse_line_boolean_attribute():
    line = 'link.rel("...").crossorigin'
    assert parse_line(line)["attributes"] == {
        "rel": "...", "crossorigin": True
    }
    
def test_parse_line_multiple_boolean_attributes():
    line = 'input.type("text").disabled.readonly'
    assert parse_line(line)["attributes"] == {
        "type": "text", "disabled": True, "readonly": True
    }

def test_parse_line_html_default_special_case():
    # This is the new, correct test for this behavior
    line = 'html.default.lang("en")'
    expected = {
        "element": "html", 
        "attributes": {"class": "default", "lang": "en"}, # .default is a class
        "content": "", "children": [],
        "multiline_trigger": False, "multiline_content": []
    }
    assert parse_line(line) == expected

def test_parse_line_multiline_trigger():
    line = 'style:'
    assert parse_line(line)["multiline_trigger"] is True
    line = 'style.class("..."): ' # Test with trailing space
    assert parse_line(line)["multiline_trigger"] is True
    assert parse_line(line)["element"] == "style"

def test_parse_line_content_pipe():
    line = "| Hello"
    assert parse_line(line)["element"] == "__text__"
    assert parse_line(line)["content"] == "Hello"

def test_parse_line_component_definition():
    line = "@define.MyComponent"
    assert parse_line(line)["element"] == "@define"
    assert parse_line(line)["attributes"] == {"class": "MyComponent"}

def test_parse_line_component_slot():
    line = "@slot"
    assert parse_line(line)["element"] == "@slot"
    
def test_parse_line_component_call():
    line = "@MyComponent"
    assert parse_line(line)["element"] == "@MyComponent"
    
def test_parse_line_component_call_with_attrs():
    line = "@MyComponent.type(\"submit\").text-xl"
    parsed = parse_line(line)
    assert parsed["element"] == "@MyComponent"
    assert parsed["attributes"]["type"] == "submit"
    assert parsed["attributes"]["class"] == ["text-xl"] # Stored as list for merging

def test_parse_line_at_style():
    line = "@style:"
    parsed = parse_line(line)
    assert parsed["element"] == "@style"
    assert parsed["multiline_trigger"] is True

# --- build_ast Tests ---

def test_build_ast_simple_nesting():
    text = "body\n    div"
    ast = build_ast(text)
    assert len(ast) == 1
    assert ast[0]["element"] == "body"
    assert len(ast[0]["children"]) == 1
    assert ast[0]["children"][0]["element"] == "div"

def test_build_ast_complex_dedent():
    text = (
        "div.a\n"
        "    p.b\n"
        "        span.c\n"
        "    p.d"
    )
    ast = build_ast(text)
    assert len(ast) == 1
    assert ast[0]["element"] == "div" # a
    assert len(ast[0]["children"]) == 2
    assert ast[0]["children"][0]["element"] == "p" # b
    assert ast[0]["children"][1]["element"] == "p" # d
    assert ast[0]["children"][0]["children"][0]["element"] == "span" # c
    
def test_build_ast_multiline_content():
    text = (
        "style:\n"
        "    body {\n"
        "        color: blue;\n"
        "    }\n"
        "div"
    )
    ast = build_ast(text)
    assert len(ast) == 2
    assert ast[0]["element"] == "style"
    assert len(ast[0]["multiline_content"]) == 3
    assert ast[0]["multiline_content"][1].strip() == "color: blue;"
    assert ast[1]["element"] == "div"

def test_build_ast_multiline_with_empty_lines():
    text = (
        "style:\n"
        "    .a\n"
        "\n"
        "    .b\n"
        "div"
    )
    ast = build_ast(text)
    assert len(ast) == 2
    assert ast[0]["element"] == "style"
    assert len(ast[0]["multiline_content"]) == 3 # .a, \n, .b
    assert ast[0]["multiline_content"][1] == "" # Preserves empty line
    assert ast[1]["element"] == "div"

def test_build_ast_ignores_comments():
    text = (
        "// This is a comment\n"
        "div.a\n"
        "    // Another comment\n"
        "    p.b\n"
        "// End comment"
    )
    ast = build_ast(text)
    assert len(ast) == 1
    assert ast[0]["element"] == "div"
    assert len(ast[0]["children"]) == 1
    assert ast[0]["children"][0]["element"] == "p"

def test_build_ast_full_example_ast(full_example_text):
    ast = build_ast(full_example_text)
    
    assert len(ast) == 2
    assert ast[0]["element"] == "doctype"
    assert ast[1]["element"] == "html"
    
    # Check the children of the <html> tag
    html_children = ast[1]["children"]
    assert len(html_children) == 2 
    assert html_children[0]["element"] == "head"
    assert html_children[1]["element"] == "body"
    
    # head children: 0:meta, 1:meta, 2:title, 3:script, 4:link, 5:link, 6:link, 7:style
    style_node = html_children[0]["children"][7] 
    assert style_node["element"] == "style"
    assert "font-family: 'VT323', monospace;" in style_node["multiline_content"][1]
    assert ".pixel-button" in style_node["multiline_content"][4]
    
def test_build_ast_simple_content_pipe():
    text = "p\n    | Hello"
    ast = build_ast(text)
    assert len(ast[0]["children"]) == 1
    text_node = ast[0]["children"][0]
    assert text_node["element"] == "__text__"
    assert text_node["content"] == "Hello"
    
def test_build_ast_mixed_content_pipe_and_elements():
    text = (
        "p\n"
        "    | Text part 1\n"
        "    strong\n"
        "        | Bold\n"
        "    | Text part 2"
    )
    ast = build_ast(text)
    assert len(ast[0]["children"]) == 3
    assert ast[0]["children"][0]["element"] == "__text__"
    assert ast[0]["children"][1]["element"] == "strong"
    assert ast[0]["children"][2]["element"] == "__text__"
    assert ast[0]["children"][1]["children"][0]["content"] == "Bold"


# --- Error Handling Tests ---

def test_build_ast_raises_for_tab_indentation():
    text = "div\n\tspan" # \t is a tab
    with pytest.raises(NMLParserError, match=r"line 2: Please use 4 spaces"):
        build_ast(text)
        
def test_build_ast_raises_for_non_standard_indentation():
    text = "div\n  span" # 2 spaces
    with pytest.raises(NMLParserError, match=r"line 2: Non-standard indentation"):
        build_ast(text)

def test_build_ast_raises_for_too_deep_indentation():
    text = "div\n        span" # 8 spaces (level 2)
    with pytest.raises(NMLParserError, match=r"line 2: Incorrect indentation level"):
        build_ast(text)

def test_build_ast_raises_for_bad_multiline_indent():
    text = "style:\n  body" # 2 spaces
    with pytest.raises(NMLParserError, match=r"Indentation error on line 2: Non-standard indentation. Use 4 spaces per level."):
        build_ast(text)

def test_build_ast_raises_for_bad_content_pipe_indent():
    text = "p\n| Hello" # 0 spaces
    with pytest.raises(NMLParserError, match=r"line 2: Content pipe '\|' must be indented one level deeper than its parent element."):
        build_ast(text)

# --- Component Tests ---
def test_component_definition_parsing():
    # --- THIS IS THE FIX ---
    # We must now check the `components` dict, not the returned AST
    components = {}
    text = "@define.MyButton\n    button.class(\"btn\")\n        @slot"
    ast = build_ast(text, components=components) # Pass in the dict
    
    assert len(ast) == 0 # @define nodes are not in the final AST
    assert "MyButton" in components
    
    component_ast = components["MyButton"]
    assert len(component_ast) == 1
    btn_node = component_ast[0]
    assert btn_node["element"] == "button"
    assert btn_node["attributes"]["class"] == "btn"
    assert btn_node["children"][0]["element"] == "@slot"
    
def test_component_expansion_simple(mock_components):
    text = "@PixelBox"
    ast = build_ast(text, components=mock_components)
    
    assert len(ast) == 1
    assert ast[0]["element"] == "div"
    # Test that the base class from the mock fixture was added
    assert ast[0]["attributes"]["class"] == "pixel-box-raised"
    
def test_component_expansion_with_slot(mock_components):
    text = "@PixelBox\n    h1(\"Title\")"
    ast = build_ast(text, components=mock_components)
    
    assert len(ast) == 1
    div_node = ast[0]
    assert div_node["element"] == "div"
    assert len(div_node["children"]) == 1
    h1_node = div_node["children"][0]
    assert h1_node["element"] == "h1"
    assert h1_node["content"] == "Title"

def test_component_expansion_with_merge_rule_1(mock_components):
    # Rule 1: Append dot-chain classes
    text = "@PixelButton.type(\"submit\").text-green-500.!text-2xl"
    ast = build_ast(text, components=mock_components)
    
    assert len(ast) == 1
    btn_node = ast[0]
    assert btn_node["element"] == "button"
    # Overrides type
    assert btn_node["attributes"]["type"] == "submit"
    # Appends classes to the base class from the mock
    assert btn_node["attributes"]["class"] == "pixel-button text-green-500 !text-2xl"
    
def test_component_expansion_with_merge_rule_2(mock_components):
    # Rule 2: Replace class with .class("...")
    text = "@PixelButton.class(\"a-new-style\").type(\"reset\")"
    ast = build_ast(text, components=mock_components)
    
    assert len(ast) == 1
    btn_node = ast[0]
    # Overrides type
    assert btn_node["attributes"]["type"] == "reset"
    # Replaces class
    assert btn_node["attributes"]["class"] == "a-new-style"
    
def test_component_expansion_nested(mock_components):
    text = (
        "@PixelBox.p-4\n"
        "    h1(\"Title\")\n"
        "    @PixelButton.mt-4\n"
        "        | Click Me"
    )
    ast = build_ast(text, components=mock_components)
    
    assert len(ast) == 1
    box_node = ast[0]
    assert box_node["element"] == "div"
    assert box_node["attributes"]["class"] == "pixel-box-raised p-4"
    
    assert len(box_node["children"]) == 2
    h1_node = box_node["children"][0]
    btn_node = box_node["children"][1]
    
    assert h1_node["element"] == "h1"
    assert h1_node["content"] == "Title"
    
    assert btn_node["element"] == "button"
    assert btn_node["attributes"]["class"] == "pixel-button mt-4"
    assert btn_node["children"][0]["element"] == "__text__"
    assert btn_node["children"][0]["content"] == "Click Me"

# --- NEW: Scoped Style Tests ---

def test_find_component_root_node():
    # --- THIS IS THE FIX ---
    # We must pass in a `components` dict to be populated
    components = {}
    ast = build_ast("@define.Test\n    // comment\n    div.root\n        p", components=components)
    
    assert "Test" in components
    # Now we test the helper function on the *component's AST*
    root_node = _find_component_root_node(components["Test"])
    assert root_node is not None
    assert root_node["element"] == "div"
    
def test_extract_scoped_style():
    # --- THIS IS THE FIX ---
    components = {}
    global_styles = {}
    ast = build_ast(
        "@define.Test\n"
        "    div\n" # Root node
        "        @slot\n"
        "    @style:\n"
        "        .my-class {\n"
        "            color: red;\n"
        "        }\n"
        "        .my-class:hover {\n"
        "            color: blue;\n"
        "        }\n"
        "    p(\"Another node\")", # Should be preserved
        components=components,
        global_styles=global_styles
    )
    
    assert "Test" in components
    component_ast = components["Test"] # This is the cleaned AST
    
    scope_id = list(global_styles.keys())[0] # Get the scope ID
    scoped_css = global_styles[scope_id]
    
    # Test 1: The AST should be cleaned (children of div)
    assert len(component_ast) == 2 # div and p
    assert component_ast[0]["element"] == "div"
    assert component_ast[1]["element"] == "p"
    
    # Test 2: The CSS should be correctly scoped
    assert f".my-class[{scope_id}] {{" in scoped_css
    assert "color: red;" in scoped_css
    assert f".my-class[{scope_id}]:hover {{" in scoped_css
    assert "color: blue;" in scoped_css
    
def test_build_ast_populates_global_styles():
    components = {}
    global_styles = {}
    nml = (
        "@define.Test\n"
        "    div\n"
        "    @style:\n"
        "        .test { color: green; }"
    )
    
    build_ast(nml, components=components, global_styles=global_styles)
    
    assert "Test" in components
    assert len(global_styles) == 1
    scope_id = list(global_styles.keys())[0]
    assert f".test[{scope_id}] {{" in global_styles[scope_id]
    
def test_scoped_style_attribute_injection():
    components = {}
    global_styles = {}
    nml = (
        "@define.Test\n"
        "    div.class(\"base\")\n" # Root node
        "        @slot\n"
        "    @style:\n"
        "        .test { color: green; }"
    )
    
    build_ast(nml, components=components, global_styles=global_styles)
    
    assert "Test" in components
    component_ast = components["Test"]
    root_node = _find_component_root_node(component_ast)
    
    assert root_node["attributes"]["class"] == "base"
    
    # Check that the scope ID was added as a boolean attribute
    scope_id_attr = [k for k in root_node["attributes"].keys() if k.startswith("nml-c-")]
    assert len(scope_id_attr) == 1
    assert root_node["attributes"][scope_id_attr[0]] is True


# --- generate_html Tests ---

def test_generate_html_simple():
    ast = build_ast("div")
    assert generate_html(ast) == "<div></div>"

def test_generate_html_with_attributes():
    ast = build_ast('a.href("#").class("btn")')
    assert generate_html(ast) == '<a href="#" class="btn"></a>'

def test_generate_html_with_content():
    ast = build_ast('h1("Hello")')
    assert generate_html(ast) == "<h1>Hello</h1>"

def test_generate_html_nested():
    ast = build_ast("div\n    p")
    assert minify(generate_html(ast)) == "<div><p></p></div>"
    
def test_generate_html_void_element():
    ast = build_ast("meta.charset(\"UTF-8\")")
    assert minify(generate_html(ast)) == '<meta charset="UTF-8">'
    
def test_generate_html_boolean_attribute():
    ast = build_ast("link.crossorigin")
    assert minify(generate_html(ast)) == "<link crossorigin>"

def test_generate_html_multiline_content():
    text = "style:\n    body {\n        color: blue;\n    }"
    ast = build_ast(text)
    html = generate_html(ast)
    assert "<style>" in html
    assert "    body {" in html
    assert "        color: blue;" in html
    assert "</style>" in html
    
def test_generate_html_doctype():
    ast = build_ast("doctype.html")
    assert generate_html(ast) == "<!DOCTYPE html>"

def test_generate_html_full_example(full_example_text):
    ast = build_ast(full_example_text) # No components in this old test
    html_output = generate_html(ast)

    # This is the new, 100% correct expected HTML
    expected_html = (
        '<!DOCTYPE html>\n'
        # The parser correctly puts class="default" here
        '<html lang="en" class="default">\n' 
        '    <head>\n'
        '        <meta charset="UTF-8">\n'
        '        <meta name="viewport" content="width=device-width, initial-scale=1.0">\n'
        '        <title>Mythic Gridiron - Login</title>\n'
        '        <script src="https://cdn.tailwindcss.com"></script>\n'
        '        <link rel="preconnect" href="https://fonts.googleapis.com">\n'
        '        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
        '        <link href="https://fonts.googleapis.com/css2?family=VT323&display=swap" rel="stylesheet">\n'
        '        <style>\n'
        "            body {\n"
        "                font-family: 'VT323', monospace;\n"
        "                background-color: #0c1524;\n"
        "            }\n"
        "            .pixel-button {\n"
        "                display: block;\n"
        "                width: 100%;\n"
        "            }\n"
        '        </style>\n'
        '    </head>\n'
        # The parser correctly puts class="text-lg" here
        '    <body class="text-lg">\n' 
        '        <div class="min-h-screen w-full flex flex-col items-center justify-center p-4">\n'
        '            <div class="pixel-box-raised w-full max-w-lg p-6">\n'
        '                <div class="text-center mb-6">\n'
        '                    <h1 class="text-5xl text-yellow-300">Sample Header!</h1>\n'
        '                    <p class="text-slate-400 text-2xl">Sample text.</p>\n'
        '                </div>\n'
        '            </div>\n'
        '        </div>\n'
        '    </body>\n'
        '</html>'
    )
    
    assert minify(html_output) == minify(expected_html)

def test_generate_html_with_variables():
    ast = build_ast('h1("Hello, {{ name }}!")')
    context = {"name": "World"}
    assert generate_html(ast, context=context) == '<h1>Hello, World!</h1>'

def test_generate_html_with_variables_in_attributes():
    ast = build_ast('a.href("{{ url }}")')
    context = {"url": "/home"}
    assert generate_html(ast, context=context) == '<a href="/home"></a>'
    
def test_generate_html_with_variables_in_multiline():
    text = "style:\n    body { color: {{ color }}; }"
    ast = build_ast(text)
    context = {"color": "red"}
    html = generate_html(ast, context=context)
    assert "color: red;" in html
    
def test_generate_html_with_variables_in_content_pipe():
    text = "p\n    | Hello, {{ name }}!"
    # --- THIS IS THE FIX ---
    ast = build_ast(text)
    context = {"name": "World"}
    html = generate_html(ast, context=context)
    assert "Hello, World!" in html