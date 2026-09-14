// @vitest-environment jsdom
// utils/goalPicker.test.ts covers the two selection helpers. What is untested is
// the page around them: the goal → results step, the state handed to the new
// protocol screen, and the back button doubling as "clear the goal".
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { GoalPicker } from './GoalPicker';

const navigate = vi.hoisted(() => vi.fn());
vi.mock('react-router', () => ({ useNavigate: () => navigate }));

function pickHealing() {
  fireEvent.click(screen.getByText('Healing & Recovery'));
}

beforeEach(() => navigate.mockReset());
afterEach(cleanup);

describe('GoalPicker', () => {
  it('opens on the goal grid', () => {
    render(<GoalPicker />);
    expect(screen.getByText('Fat Loss')).toBeTruthy();
  });

  it('lists the peptides for the chosen goal', () => {
    render(<GoalPicker />);
    pickHealing();
    expect(screen.getByText('BPC-157')).toBeTruthy();
  });

  it('hides peptides from other goals', () => {
    render(<GoalPicker />);
    pickHealing();
    expect(screen.queryByText('Semaglutide')).toBeNull();
  });

  it('preselects the chosen peptide on the new protocol screen', () => {
    render(<GoalPicker />);
    pickHealing();
    fireEvent.click(screen.getByText('BPC-157'));
    expect(navigate).toHaveBeenCalledWith('/protocols/new', { state: { preselectPeptideIds: ['bpc-157'] } });
  });

  // Not the BPC-157 + TB-500 stack: a pre-mixed blend peptide of the same name
  // is also listed under this goal, so that label is ambiguous in the DOM.
  it('preselects both halves of a synergy stack', () => {
    render(<GoalPicker />);
    pickHealing();
    fireEvent.click(screen.getByText('BPC-157 + KPV'));
    expect(navigate).toHaveBeenCalledWith('/protocols/new', { state: { preselectPeptideIds: ['bpc-157', 'kpv'] } });
  });

  it('returns to the goal grid instead of leaving the page', () => {
    render(<GoalPicker />);
    pickHealing();
    fireEvent.click(screen.getByLabelText('Back'));
    expect(screen.getByText('Fat Loss')).toBeTruthy();
  });
});
