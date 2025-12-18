import { Entity, ObjectIdColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, ObjectId } from "typeorm";
import { Payment } from "./Payment.js";

@Entity("users")
export class User {
    @ObjectIdColumn()
    _id!: ObjectId;

    @Column()
    id!: string;

    @Column({ unique: true })
    telegramId!: number;

    @Column({ nullable: true })
    username?: string;

    @Column({ nullable: true })
    firstName?: string;

    @Column({ nullable: true })
    lastName?: string;

    @Column({ default: false })
    hasPaid!: boolean;

    @Column({ default: 0 })
    viewedAnecdotes!: number;

    @OneToMany(() => Payment, payment => payment.user)
    payments!: Payment[];

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}
