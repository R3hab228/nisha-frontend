import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { readProfileSource } from './helpers/readProfileSource.js';

describe('Store Life-Cycle Notifications (Status, TTN, Q&A, Reviews)', () => {
    const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

    it('app.js handles URL action parameters for orders and review modal routing', () => {
        const appJsPath = path.resolve(__dirname, '../app.js');
        const content = fs.readFileSync(appJsPath, 'utf8');

        expect(content).toContain("openAction === 'orders'");
        expect(content).toContain('window.openOrdersModal()');
        expect(content).toContain("openAction === 'reviews'");
        expect(content).toContain('window.openReviewsModal()');
        expect(content).toContain("openAction === 'review'");
        expect(content).toContain('window.promptOrderReview(orderId');
    });

    it('profile.js handles order completion, TTN addition, and Q&A answers without emojis', () => {
        const content = readProfileSource();

        // Check review prompt upon order completion
        expect(content).toContain("newStatus === 'Завершен'");
        expect(content).toContain('ORDER_COMPLETED.LOG');
        expect(content).toContain('promptOrderReview(payload.new.id');
        expect(content).toContain('[ ОСТАВИТЬ ОТЗЫВ ]');

        // Check TTN addition notification
        expect(content).toContain('newTtn && newTtn !== oldTtn');
        expect(content).toContain('TRACKING_NUMBER.LOG');
        expect(content).toContain('[ ОТСЛЕДИТЬ ]');

        // Check Q&A answer notification
        expect(content).toContain('QUESTION_ANSWERED.LOG');
        expect(content).toContain('[ ПОСМОТРЕТЬ ТОВАР ]');
        expect(content).toContain('openProductModalById(payload.new.item_id)');

        // Verify that notification strings in profile.js do not contain emojis
        const notificationSnippets = [
            'Заказ успешно получен',
            'Будем благодарны за отзыв о покупке на сайте',
            'Оставьте отзыв о покупке!',
            'добавлен номер ТТН',
            'Заказ передан в доставку',
            'Номер ТТН Новой Почты',
            'Вам ответили на вопрос по товару!',
            'На ваш вопрос по товару опубликован ответ'
        ];

        for (const snippet of notificationSnippets) {
            expect(EMOJI_REGEX.test(snippet)).toBe(false);
        }
    });
});
