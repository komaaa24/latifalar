import "reflect-metadata";
import { DataSource } from "typeorm";
import { Anecdote } from "../entities/Anecdote.js";
import { Payment } from "../entities/Payment.js";
import { User } from "../entities/User.js";

export const AppDataSource = new DataSource({
    type: "mongodb",
    url: process.env.MONGODB_URI || "mongodb://localhost:27017/munajjim",
    synchronize: true, // Auto-sync schema (dev only)
    logging: process.env.NODE_ENV === "development",
    entities: [Anecdote, Payment, User],
    subscribers: [],
    migrations: [],
});
