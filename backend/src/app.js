import cors from "cors";
import express from "express";
import apiRouter from "./routes/api.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use("/api", apiRouter);

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({
    message: error.message || "Unexpected server error."
  });
});

export default app;
