import { Hono } from "hono";
import { serveStatic } from "hono/cloudflare-workers";
import renderIndex from "../views/index.nml";

interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

const app = new Hono<{ Bindings: { TODOS: D1Database } }>();

// In-memory store for demo (in production, use D1 or KV)
let todos: Todo[] = [
  { id: 1, text: "Learn NML", completed: true },
  { id: 2, text: "Build HTMX app", completed: false },
  { id: 3, text: "Deploy to Workers", completed: false },
];

// Serve static assets
app.use("/*", serveStatic({ root: "./" }));

// Render main page
app.get("/", (c) => {
  const html = renderIndex({ todos });
  return c.html(html);
});

// API routes for HTMX
app.get("/api/todos", (c) => {
  return c.json(todos);
});

app.post("/api/todos", async (c) => {
  const body = await c.req.parseBody();
  const text = body.text as string;
  
  if (text && text.trim()) {
    const newTodo: Todo = {
      id: Math.max(...todos.map(t => t.id), 0) + 1,
      text: text.trim(),
      completed: false,
    };
    todos.push(newTodo);
  }
  
  // Return the updated todo list HTML
  const html = renderIndex({ todos });
  return c.html(html);
});

app.put("/api/todos/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  const todo = todos.find(t => t.id === id);
  
  if (todo) {
    todo.completed = !todo.completed;
  }
  
  // Return the updated todo item HTML
  const todoHtml = `
    <div class="todo-item ${todo?.completed ? 'completed' : ''}">
      <input type="checkbox" ${todo?.completed ? 'checked' : ''} 
             hx-put="/api/todos/${id}" hx-target="closest .todo-item" hx-trigger="change">
      <span>${todo?.text}</span>
    </div>
  `;
  
  return c.html(todoHtml);
});

export default app;