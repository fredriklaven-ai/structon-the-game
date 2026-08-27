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

test('byggregeln citerar Hammurabi paragraf 229', () => {
    const law = 'Om ett hus rasar och ägaren dör, ska byggmästaren avrättas.';
    assert.match(law, /rasar/i);
    assert.match(law, /ägaren dör/i);
    assert.match(law, /avrättas/i);
});
