import dotenv from "dotenv";
import app from "./app.js";
import { connectDatabase } from "./config/database.js";

dotenv.config();

const port = Number(process.env.PORT || 4000);

async function bootstrap() {
  try {
    await connectDatabase();
    app.listen(port, () => {
      console.log(`IMS backend running on http://localhost:${port}`);
    });
  } catch (error) {
    console.error("Failed to start backend:", error);
    if (error?.original?.code === "ECONNREFUSED" || error?.parent?.code === "ECONNREFUSED") {
      console.error("");
      console.error("MySQL is not running or not installed.");
      console.error("1. Start your MySQL server");
      console.error("2. Make sure it is listening on 127.0.0.1:3306");
      console.error("3. Update backend/.env with your real MySQL username and password");
      console.error("4. Create the database named ims_portal");
      console.error("5. Run npm.cmd run dev again");
    }
    process.exit(1);
  }
}

bootstrap();
