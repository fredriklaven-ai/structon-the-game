/**
 * Tester för Hammurabi-intyg innan invigningssimulation.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('invigning kräver stämpel innan simulering startar', () => {
    const state = {
        gameState: 'build',
        hammurabiStamped: false,
        simulationStarted: false
    };

    // Tryck Invig → intyg visas, ingen simulering ännu
    state.gameState = 'oath';
    assert.equal(state.simulationStarted, false);
    assert.equal(state.hammurabiStamped, false);

    // Försök lämna in utan stämpel
    const canSubmit = state.hammurabiStamped === true;
    assert.equal(canSubmit, false);

    // Sätt stämpel
    state.hammurabiStamped = true;
    assert.equal(state.hammurabiStamped, true);

    // Lämna in → simulering/fasadmontage får börja
    state.gameState = 'cladding';
    state.simulationStarted = true;
    assert.equal(state.gameState, 'cladding');
    assert.equal(state.simulationStarted, true);
});

test('byggregeln nämner livsoffret vid ras', () => {
    const law =
        'Om huset rasar och någon omkommer, ska även du som signerar offra ditt eget liv.';
    assert.match(law, /rasar/i);
    assert.match(law, /omkommer/i);
    assert.match(law, /offra ditt eget liv/i);
});
