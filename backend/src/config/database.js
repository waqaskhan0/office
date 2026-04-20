import dotenv from "dotenv";
import { Sequelize } from "sequelize";

dotenv.config();

export const sequelize = new Sequelize(
  process.env.MYSQL_DATABASE || "ims_portal",
  process.env.MYSQL_USER || "root",
  process.env.MYSQL_PASSWORD || "",
  {
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: Number(process.env.MYSQL_PORT || 3306),
    dialect: "mysql",
    logging: false
  }
);

export async function connectDatabase() {
  await sequelize.authenticate();
  if ((process.env.DB_SYNC || "true").toLowerCase() === "true") {
    await sequelize.sync();
  }
}
