import { Entity, ObjectIdColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, ObjectId } from "typeorm";
import { User } from "./User.js";

export enum PaymentStatus {
    PENDING = "pending",
    PAID = "paid",
    FAILED = "failed",
    CANCELLED = "cancelled"
}

@Entity("payments")
export class Payment {
    @ObjectIdColumn()
    _id!: ObjectId;

    @Column()
    id!: string;

    @Column({ unique: true })
    transactionParam!: string;

    @ManyToOne(() => User, user => user.payments)
    @JoinColumn({ name: "userId" })
    user!: User;

    @Column()
    userId!: string;

    @Column()
    amount!: number;

    @Column({ default: PaymentStatus.PENDING })
    status!: PaymentStatus;

    @Column({ nullable: true })
    clickTransId?: string;

    @Column({ nullable: true })
    merchantTransId?: string;

    @Column({ nullable: true })
    metadata?: Record<string, any>;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}