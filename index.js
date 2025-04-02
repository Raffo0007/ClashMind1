import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// Connessione a Supabase
const supabaseUrl = "https://wmudphzzlyovwpeeoqyf.supabase.co";
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Middleware per file statici e parsing body
app.use(express.static(path.join(__dirname, "public")));
app.use(express.static(path.join(__dirname, "assets"))); // per le risorse grafiche
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Imposta EJS come view engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Middleware per sessione fittizia (in produzione integra express-session)
app.use((req, res, next) => {
  req.session = {};
  next();
});

// Rotta Home: elenco gruppi con barra di ricerca
app.get("/", async (req, res) => {
  const search = req.query.search;
  let query = supabase
    .from("groups")
    .select("*")
    .order("created_at", { ascending: false });
  if (search) {
    query = query.ilike("name", `%${search}%`);
  }
  const { data: groups, error } = await query;
  if (error) console.error(error);
  res.render("index", { groups });
});

// Rotte per autenticazione: Registrazione e Login
app.get("/signup", (req, res) => {
  res.render("auth", { mode: "signup", error: null });
});

app.get("/signin", (req, res) => {
  res.render("auth", { mode: "signin", error: null });
});

app.post("/signup", async (req, res) => {
  const { email, password } = req.body;
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    return res.render("auth", { mode: "signup", error: error.message });
  }
  res.redirect("/signin");
});

app.post("/signin", async (req, res) => {
  const { email, password } = req.body;
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) {
    return res.render("auth", { mode: "signin", error: error.message });
  }
  req.session.user = data.user;
  res.redirect("/");
});

// Visualizzazione dei dettagli di un gruppo e relativi post
app.get("/group/:id", async (req, res) => {
  const groupId = req.params.id;
  const { data: group, error: groupError } = await supabase
    .from("groups")
    .select("*")
    .eq("id", groupId)
    .single();
  if (groupError) return res.send("Gruppo non trovato.");

  const { data: posts, error: postsError } = await supabase
    .from("posts")
    .select("*")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false });
  if (postsError) console.error(postsError);

  res.render("group", { group, posts });
});

// Creazione di un nuovo gruppo
app.get("/new-group", (req, res) => {
  res.render("new-group", { error: null });
});

app.post("/new-group", async (req, res) => {
  const { name, description } = req.body;
  const created_by = req.session.user ? req.session.user.id : null;
  const { data, error } = await supabase
    .from("groups")
    .insert([{ name, description, created_by }]);
  if (error) {
    return res.render("new-group", { error: error.message });
  }
  res.redirect("/");
});

// Creazione di un nuovo post in un gruppo
app.post("/group/:id/post", async (req, res) => {
  const groupId = req.params.id;
  const { content } = req.body;
  const user_id = req.session.user ? req.session.user.id : null;
  const { data, error } = await supabase
    .from("posts")
    .insert([{ group_id: groupId, content, user_id }]);
  if (error) {
    return res.send("Errore nella creazione del post: " + error.message);
  }
  res.redirect("/group/" + groupId);
});

app.listen(port, () => {
  console.log(`ClashMind in ascolto sulla porta ${port}`);
});
