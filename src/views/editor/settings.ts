// The "Settings" tab, in Google's groups: quiz, responses (with who fills in
// and who reads, which are Potok's roles), presentation and defaults. What
// Potok must hold to goes into the rules of the config on the next save.

import { html, nothing } from 'lit-html';
import { hasFileQuestion } from '../../model/form';
import { fromLocalInput, localInput } from '../../model/format';
import { editSettings } from '../../store/editor';
import { state } from '../../store/state';
import { notice, rolePicker, select, toggle, ui, underlined } from '../common';

function group(title: string, body: unknown, id: string) {
  return html`<section class="pf-card pf-settings-card" id=${id}>
    <h2 class="pf-settings-title">${title}</h2>
    <div class="pf-settings-body">${body}</div>
  </section>`;
}

function row(label: string, control: unknown, hint?: string) {
  return html`<div class="pf-setting">
    <div class="pf-setting-text">
      <div>${label}</div>
      ${hint ? html`<div class="pf-muted pf-small">${hint}</div>` : nothing}
    </div>
    <div class="pf-setting-control">${control}</div>
  </div>`;
}

export function settingsTab() {
  const t = ui.t;
  const settings = state.form.settings;
  const quiz = settings.quiz;
  const files = hasFileQuestion(state.form);
  const fileStatus = state.reply?.files;

  return html`<div class="pf-column pf-settings">
    ${group(
      t('settingsQuiz'),
      html`${row(
          t('settingsQuiz'),
          toggle(quiz.enabled, t('settingsQuiz'), (on) =>
            editSettings((s) => {
              s.quiz.enabled = on;
              if (on && s.quiz.release === 'immediate') s.editOwn = false;
            }), { id: 'setting-quiz' }),
          t('quizHint'),
        )}
        ${quiz.enabled
          ? html`${row(
                t('release'),
                select(quiz.release, [
                  { value: 'immediate', label: t('releaseImmediate') },
                  { value: 'manual', label: t('releaseManual') },
                ], (value) =>
                  editSettings((s) => {
                    s.quiz.release = value;
                    if (value === 'immediate') s.editOwn = false;
                  }), { id: 'setting-release' }),
              )}
              <div class="pf-setting pf-setting-stack">
                <div>${t('respondentSees')}</div>
                ${toggle(quiz.showMissed, t('missedQuestions'), (on) => editSettings((s) => (s.quiz.showMissed = on)))}
                ${toggle(quiz.showCorrect, t('correctAnswers'), (on) => editSettings((s) => (s.quiz.showCorrect = on)))}
                ${toggle(quiz.showPoints, t('pointValues'), (on) => editSettings((s) => (s.quiz.showPoints = on)))}
              </div>
              ${row(
                t('defaultPoints'),
                html`<input
                  type="number"
                  min="0"
                  max="1000"
                  class="pf-field pf-narrow"
                  aria-label=${t('defaultPoints')}
                  .value=${String(quiz.defaultPoints)}
                  @change=${(event: Event) =>
                    editSettings((s) => (s.quiz.defaultPoints = Math.max(0, Math.min(1000, Math.round(Number((event.target as HTMLInputElement).value) || 0)))))}
                />`,
              )}`
          : nothing}`,
      'settings-quiz',
    )}
    ${group(
      t('settingsResponses'),
      html`<div class="pf-setting pf-setting-stack">
          <div>${t('whoFills')}</div>
          ${settings.public
            ? html`<p class="pf-muted pf-small">${t('publicHint')}</p>`
            : rolePicker('fill-roles', settings.fill, (keys) => editSettings((s) => (s.fill = keys)))}
        </div>
        <div class="pf-setting pf-setting-stack">
          <div>${t('whoViews')}</div>
          ${rolePicker('view-roles', settings.view, (keys) => editSettings((s) => (s.view = keys)))}
          <p class="pf-muted pf-small">${t('editorsAlways')}</p>
        </div>
        ${row(t('publicForm'), toggle(settings.public, t('publicForm'), (on) => editSettings((s) => (s.public = on)), { id: 'setting-public' }), `${t('publicHint')} ${t('publicGroupOnly')}`)}
        ${row(
          t('anonymous'),
          toggle(settings.anonymous && !files, t('anonymous'), (on) => editSettings((s) => (s.anonymous = on)), { id: 'setting-anonymous', disabled: files }),
          files ? t('anonymousNoFiles') : t('anonymousHint'),
        )}
        ${row(t('once'), toggle(settings.once, t('once'), (on) => editSettings((s) => (s.once = on)), { id: 'setting-once' }), t('onceHint'))}
        ${row(
          t('editOwn'),
          toggle(settings.editOwn, t('editOwn'), (on) => editSettings((s) => (s.editOwn = on)), {
            id: 'setting-edit-own',
            disabled: quiz.enabled && quiz.release === 'immediate',
          }),
          quiz.enabled && quiz.release === 'immediate' ? t('editOwnQuiz') : undefined,
        )}
        ${row(t('summaryForRespondents'), toggle(settings.summaryForRespondents, t('summaryForRespondents'), (on) => editSettings((s) => (s.summaryForRespondents = on)), { id: 'setting-summary' }))}
        ${row(
          t('closesAt'),
          html`<input
            type="datetime-local"
            class="pf-field pf-narrow-date"
            id="setting-closes-at"
            aria-label=${t('closesAt')}
            .value=${localInput(settings.closesAt)}
            @change=${(event: Event) => editSettings((s) => (s.closesAt = fromLocalInput((event.target as HTMLInputElement).value)))}
          />`,
          settings.closesAt ? undefined : t('noDeadline'),
        )}
        ${files && fileStatus?.private === 'exposed' ? notice(t('filesExposed'), 'warning') : nothing}`,
      'settings-responses',
    )}
    ${group(
      t('settingsPresentation'),
      html`${row(t('progressBar'), toggle(settings.progressBar, t('progressBar'), (on) => editSettings((s) => (s.progressBar = on))))}
        ${row(t('shuffleQuestions'), toggle(settings.shuffleQuestions, t('shuffleQuestions'), (on) => editSettings((s) => (s.shuffleQuestions = on))))}
        <div class="pf-setting pf-setting-stack">
          <div>${t('confirmation')}</div>
          ${underlined(settings.confirmation, t('confirmationDefault'), (value) => editSettings((s) => (s.confirmation = value), 'confirmation'), {
            multiline: true,
            id: 'setting-confirmation',
          })}
        </div>
        ${row(t('anotherLink'), toggle(settings.anotherLink, t('anotherLink'), (on) => editSettings((s) => (s.anotherLink = on))))}`,
      'settings-presentation',
    )}
    ${group(
      t('settingsDefaults'),
      row(
        t('requiredDefault'),
        // As in Google's, it holds for the questions still to come.
        toggle(settings.requiredDefault, t('requiredDefault'), (on) => editSettings((s) => (s.requiredDefault = on))),
      ),
      'settings-defaults',
    )}
  </div>`;
}
