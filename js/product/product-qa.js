// ==========================================
// NISHA PRODUCT Q&A & ACCORDION SYSTEM MODULE
// ==========================================

import {
    getActiveOpenedItem,
    getStore,
    getSupabaseClient,
    getUser
} from './product-state.js';
import { hasAction, invokeAction, registerActions } from '../core/action-registry.js';
import { getRuntimeProfile } from '../core/runtime-env.js';

/**
 * Expands or collapses the inline question submission form.
 */
export function toggleQuestionForm() {
    const container = document.getElementById('questionFormContainer');
    if (!container) return;

    if (container.style.maxHeight === '0px' || container.style.maxHeight === '') {
        container.style.maxHeight = '100px';
        setTimeout(() => {
            const input = document.getElementById('questionInput');
            if (input) input.focus();
        }, 100);
    } else {
        container.style.maxHeight = '0px';
    }
}

/**
 * Validates and submits a buyer question for the specified item via `/api/question`.
 * @param {string|number} itemId
 * @returns {Promise<void>}
 */
export async function submitQuestion(itemId) {
    const currentUser = getUser();
    if (!currentUser) {
        const authMsg = (typeof i18next !== 'undefined' && i18next.t('product.qa_err_auth')) || 'Для отправки вопроса нужно войти в аккаунт!';
        showToast(authMsg, 'error');
        if (typeof openProfileModal === 'function') openProfileModal();
        return;
    }

    const input = document.getElementById('questionInput');
    if (!input) return;
    let text = input.value.trim();
    if (text.length < 5) {
        const shortMsg = (typeof i18next !== 'undefined' && i18next.t('product.qa_err_short')) || 'Вопрос слишком короткий!';
        showToast(shortMsg, 'error');
        return;
    }
    if (text.length > 100) {
        text = hasAction('safeTruncateText')
            ? invokeAction('safeTruncateText', text, 100)
            : text.slice(0, 100);
    }

    const today = new Date().toISOString().slice(0, 10);
    const store = getStore();
    let questionData = store ? store.getJSON('nisha_questions', { date: '', count: 0 }) : { date: '', count: 0 };

    if (questionData.date !== today) questionData = { date: today, count: 0 };
    if (questionData.count >= 2) {
        if (typeof triggerHaptic === 'function') triggerHaptic('error');
        const limitMsg = (typeof i18next !== 'undefined' && i18next.t('product.qa_err_limit')) || 'Лимит: 2 вопроса в день.';
        return showToast(limitMsg, 'error');
    }

    let itemName = 'Товар';
    const active = getActiveOpenedItem();
    if (active && active.id === itemId) {
        itemName = active.name;
    }

    const runSubmitQuestion = async () => {
        try {
            const profile = getRuntimeProfile();
            const userDisplayName = hasAction('getUserDisplayName')
                ? invokeAction('getUserDisplayName', currentUser, profile)
                : (profile?.username || currentUser.user_metadata?.display_name || currentUser.user_metadata?.username || currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || (currentUser.email ? currentUser.email.split('@').at(0) : 'User'));

            const data = await window.apiClient.post('/api/question', {
                userId: currentUser.id,
                email: currentUser.email || 'Неизвестно',
                username: userDisplayName,
                itemId,
                itemName,
                questionText: text
            }, { timeout: 12000, retries: 1 });

            if (data && data.success) {
                questionData.count += 1;
                if (store) store.setJSON('nisha_questions', questionData);
                input.value = '';
                toggleQuestionForm();
                const sentMsg = (typeof i18next !== 'undefined' && i18next.t('product.qa_success')) || 'Вопрос отправлен!';
                showToast(sentMsg, 'success');
            } else {
                const sendErrMsg = (typeof i18next !== 'undefined' && i18next.t('product.qa_err_send')) || 'Ошибка при отправке вопроса.';
                showToast(sendErrMsg, 'error');
            }
        } catch (err) {
            const connErrMsg = (typeof i18next !== 'undefined' && i18next.t('propose.err_network')) || 'Ошибка соединения с сервером.';
            showToast(connErrMsg, 'error');
        }
    };

    if (hasAction('withButtonBusy')) {
        await invokeAction('withButtonBusy', '[data-action="submit-question"]', runSubmitQuestion);
    } else {
        await runSubmitQuestion();
    }
}

/**
 * Fetches and renders Q&A entries for the given item from Supabase.
 * @param {string|number} itemId
 * @returns {Promise<void>}
 */
export async function loadItemQuestions(itemId) {
    const sb = getSupabaseClient();
    if (!sb) return;

    const { data } = await sb.from('item_questions')
        .select('question, answer, user_name, created_at')
        .eq('item_id', itemId)
        .order('created_at', { ascending: true });

    const wrapper = document.getElementById('qaWrapper');
    const list = document.getElementById('qaList');

    if (data && data.length > 0 && wrapper && list) {
        wrapper.style.display = 'block';
        if (typeof list.replaceChildren === 'function') list.replaceChildren();
        else list.innerHTML = '';

        const escEntity = (s) => String(s ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
        const sanitize = hasAction('sanitizeText')
            ? (s) => invokeAction('sanitizeText', s)
            : escEntity;

        let listHtml = '';
        data.forEach(q => {
            const safeQ = sanitize(q.question);
            const safeA = q.answer ? sanitize(q.answer) : null;
            const safeU = sanitize(q.user_name);

            const answerHtml = safeA ? `<div style="color: var(--accent-green); font-size: 12px; font-weight: bold; margin-top: 4px;">↳ NISHA: ${safeA}</div>` : '';
            listHtml += `
                <div style="border-left: 2px solid #333; padding-left: 10px; margin-bottom: 12px; font-family: var(--font-main);">
                    <span style="color:#888; font-size:11px; font-family:var(--font-mono);">@${safeU}:</span>
                    <div style="color:#ddd; font-size:13px; margin-top:2px;">${safeQ}</div>
                    ${answerHtml}
                </div>`;
        });
        list.innerHTML = listHtml;
    } else if (wrapper) {
        wrapper.style.display = 'none';
    }
}

/**
 * Toggles accordion `.custom-details` block exclusively.
 * @param {HTMLElement} element
 */
export function toggleAccordion(element) {
    if (!element) return;
    const parent = element.parentElement;
    if (!parent) return;
    const isOpen = parent.classList.contains('open');

    document.querySelectorAll('.custom-details').forEach(el => el.classList.remove('open'));
    if (!isOpen) {
        parent.classList.add('open');
    }
}

/**
 * Toggles collapsed state of `#qaCollapseWrapper` and rotates accordion arrow.
 * @param {HTMLElement|null} btn
 */
export function toggleQASection(btn) {
    const wrap = document.getElementById('qaCollapseWrapper');
    const list = document.getElementById('qaList');
    let isCollapsed = false;
    if (wrap) {
        isCollapsed = wrap.classList.toggle('collapsed');
    } else if (list) {
        isCollapsed = list.classList.toggle('collapsed');
    }
    const arrow = btn ? btn.querySelector('.qa-arrow') : document.querySelector('#qaWrapper .qa-arrow');
    if (arrow) {
        arrow.style.transform = isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)';
    }
}

/**
 * Initializes Supabase Realtime subscription for live Q&A updates.
 */
let _productQaSubInitialized = false;

export function initProductQASubscription() {
    if (_productQaSubInitialized) return;
    const sb = getSupabaseClient();
    if (sb && typeof sb.channel === 'function') {
        _productQaSubInitialized = true;
        sb.channel('public-qa-updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'item_questions' }, payload => {
                const active = getActiveOpenedItem();
                if (active && payload.new && payload.new.item_id === active.id) {
                    if (hasAction('loadItemQuestions')) {
                        invokeAction('loadItemQuestions', active.id);
                    } else {
                        loadItemQuestions(active.id);
                    }
                }
            })
            .subscribe();
    }
}

registerActions({
    toggleQuestionForm,
    submitQuestion,
    loadItemQuestions,
    toggleAccordion,
    toggleQASection,
    initProductQASubscription
});
