import { Request, Response } from "express";
import { Repository } from "typeorm";
import { Payment, PaymentStatus } from "../entities/Payment.js";
import { AppDataSource } from "../database/data-source.js";
import { UserService } from "../services/user.service.js";
import { generateClickResponseSignature, verifyClickSignature } from "../services/click.service.js";
import { Bot } from "grammy";

const userService = new UserService();

/**
 * Click PREPARE method
 * To'lovni tayyorlash (pre-authorization)
 * Docs: https://docs.click.uz/merchant-api-request/
 */
export async function handleClickPrepare(req: Request, res: Response, bot: Bot) {
    const {
        click_trans_id,
        service_id,
        merchant_trans_id,
        merchant_user_id,
        amount,
        action,
        sign_time,
        sign_string,
        error,
        error_note
    } = req.body;

    const secretKey = process.env.CLICK_SECRET_KEY!;

    // Signature tekshirish
    const isValidSignature = verifyClickSignature(
        click_trans_id,
        service_id,
        secretKey,
        merchant_trans_id,
        amount,
        action,
        sign_time,
        sign_string
    );

    if (!isValidSignature) {
        console.error("❌ PREPARE: Invalid signature!");
        return res.json({
            click_trans_id,
            merchant_trans_id,
            merchant_prepare_id: null,
            error: -1,
            error_note: "SIGN_CHECK_FAILED: Invalid signature"
        });
    }

    const paymentRepo = AppDataSource.getRepository(Payment);

    // Tranzaksiyani topish
    const payment = await paymentRepo.findOne({
        where: { transactionParam: merchant_trans_id },
        relations: ["user"]
    });

    if (!payment) {
        console.error(`❌ PREPARE: Transaction not found: ${merchant_trans_id}`);
        return res.json({
            click_trans_id,
            merchant_trans_id,
            merchant_prepare_id: null,
            error: -6,
            error_note: "TRANSACTION_NOT_FOUND: Transaction not found in database"
        });
    }


    // Summa tekshirish
    if (parseFloat(amount) !== parseFloat(payment.amount.toString())) {
        console.error(`❌ PREPARE: Amount mismatch - Expected: ${payment.amount}, Got: ${amount}`);
        return res.json({
            click_trans_id,
            merchant_trans_id,
            merchant_prepare_id: null,
            error: -2,
            error_note: "INVALID_AMOUNT: Incorrect amount"
        });
    }

    // Agar allaqachon to'langan bo'lsa
    if (payment.status === PaymentStatus.PAID) {
        console.warn(`⚠️ PREPARE: Already paid - Transaction: ${merchant_trans_id}`);
        return res.json({
            click_trans_id,
            merchant_trans_id,
            merchant_prepare_id: payment.id,
            error: -4,
            error_note: "ALREADY_PAID: This transaction already paid"
        });
    }

    // Merchant prepare ID sifatida payment.id ishlatamiz
    const merchantPrepareIdNum = payment.id;

    // Response signature yaratish
    const responseSignature = generateClickResponseSignature(
        click_trans_id,
        service_id,
        secretKey,
        merchant_trans_id,
        merchantPrepareIdNum.toString(),
        amount,
        action,
        sign_time
    );


    // Muvaffaqiyatli javob
    const response = {
        click_trans_id,
        merchant_trans_id,
        merchant_prepare_id: merchantPrepareIdNum,
        error: 0,
        error_note: "Success",
        sign_time,
        sign_string: responseSignature
    };

    return res.json(response);
}

/**
 * Click COMPLETE method
 * To'lovni yakunlash
 * Docs: https://docs.click.uz/merchant-api-request/
 */
export async function handleClickComplete(req: Request, res: Response, bot: Bot) {
    const {
        click_trans_id,
        service_id,
        merchant_trans_id,
        merchant_prepare_id,
        merchant_user_id,
        amount,
        action,
        sign_time,
        sign_string,
        error
    } = req.body;

    console.log(`
╔════════════════════════════════════════════════════════════╗
    `);

    const secretKey = process.env.CLICK_SECRET_KEY!;

    // Signature tekshirish
    const isValidSignature = verifyClickSignature(
        click_trans_id,
        service_id,
        secretKey,
        merchant_trans_id,
        amount,
        action,
        sign_time,
        sign_string
    );

    if (!isValidSignature) {
        console.error("❌ COMPLETE: Invalid signature!");
        return res.json({
            click_trans_id,
            merchant_trans_id,
            merchant_prepare_id,
            error: -1,
            error_note: "SIGN_CHECK_FAILED: Invalid signature"
        });
    }

    // Agar Click o'zidan xatolik yuborgan bo'lsa
    if (error && error < 0) {
        console.error(`❌ COMPLETE: Click sent error: ${error}`);
        return res.json({
            click_trans_id,
            merchant_trans_id,
            merchant_prepare_id,
            error: error,
            error_note: "Error from Click"
        });
    }

    const paymentRepo = AppDataSource.getRepository(Payment);

    // Tranzaksiyani topish
    const payment = await paymentRepo.findOne({
        where: {
            transactionParam: merchant_trans_id,
            id: parseInt(merchant_prepare_id)
        },
        relations: ["user"]
    });

    if (!payment) {
        console.error(`❌ COMPLETE: Transaction not found - Trans ID: ${merchant_trans_id}, Prepare ID: ${merchant_prepare_id}`);
        return res.json({
            click_trans_id,
            merchant_trans_id,
            merchant_prepare_id,
            error: -6,
            error_note: "TRANSACTION_NOT_FOUND: Transaction not found in database"
        });
    }


    // Agar Click error qaytargan bo'lsa
    if (error && error !== 0) {
        console.error(`❌ COMPLETE: Payment failed with Click error: ${error}`);
        payment.status = PaymentStatus.FAILED;
        payment.metadata = {
            ...payment.metadata,
            clickError: error,
            failedAt: new Date().toISOString()
        };
        await paymentRepo.save(payment);

        return res.json({
            click_trans_id,
            merchant_trans_id,
            merchant_prepare_id,
            error: -9,
            error_note: "Transaction cancelled"
        });
    }

    // Agar allaqachon to'langan bo'lsa
    if (payment.status === PaymentStatus.PAID) {
        const responseSignature = generateClickResponseSignature(
            click_trans_id,
            service_id,
            secretKey,
            merchant_trans_id,
            merchant_prepare_id,
            amount,
            action,
            sign_time
        );

        return res.json({
            click_trans_id,
            merchant_trans_id,
            merchant_prepare_id,
            error: -4,
            error_note: "Already paid",
            sign_time,
            sign_string: responseSignature
        });
    }

    // To'lovni yakunlash
    payment.status = PaymentStatus.PAID;
    payment.clickTransId = click_trans_id;
    payment.merchantTransId = merchant_trans_id;
    await paymentRepo.save(payment);

    // Foydalanuvchini to'lagan deb belgilash
    const telegramId = payment.metadata?.telegramId;
    if (telegramId) {
        await userService.markAsPaid(telegramId);

        // Telegram orqali xabar yuborish
        try {
            await bot.api.sendMessage(
                telegramId,
                `✅ <b>To'lovingiz muvaffaqiyatli amalga oshirildi!</b>\n\n` +
                `💰 Summa: ${amount} so'm\n` +
                `🎉 Endi siz cheksiz latifalardan bahramand bo'lishingiz mumkin!\n\n` +
                `Davom etish uchun /start buyrug'ini bering.`,
                { parse_mode: "HTML" }
            );
        } catch (error) {
            console.error("Failed to send notification:", error);
        }
    }

    // Response signature yaratish
    const responseSignature = generateClickResponseSignature(
        click_trans_id,
        service_id,
        secretKey,
        merchant_trans_id,
        merchant_prepare_id,
        amount,
        action,
        sign_time
    );


    return res.json({
        click_trans_id,
        merchant_trans_id,
        merchant_prepare_id,
        error: 0,
        error_note: "Success",
        sign_time,
        sign_string: responseSignature
    });
}
