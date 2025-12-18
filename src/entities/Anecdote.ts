import { Entity, ObjectIdColumn, Column, CreateDateColumn, Index, ObjectId } from "typeorm";

@Entity("anecdotes")
@Index(["section"])
export class Anecdote {
    @ObjectIdColumn()
    _id!: ObjectId;

    @Column()
    id!: string;

    @Column({ unique: true })
    externalId!: string;

    @Column({ default: "general" })
    section!: string;

    @Column()
    content!: string;

    @Column({ default: 0 })
    views!: number;

    @CreateDateColumn()
    createdAt!: Date;
}