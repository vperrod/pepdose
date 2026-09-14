// @vitest-environment jsdom
// Four-step carousel with two exits (finish and skip); both must set the
// onboarded flag or the user sees the intro again on every launch.
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { Onboarding } from './Onboarding';

function clickContinue() {
  fireEvent.click(screen.getByText('Continue'));
}

// Four steps: three Continues land on the final one.
function goToFinalStep() {
  clickContinue(); clickContinue(); clickContinue();
}

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('Onboarding', () => {
  it('opens on the first step', () => {
    render(<Onboarding onComplete={vi.fn()} />);
    expect(screen.getByText('Track Your Protocols')).toBeTruthy();
  });

  it('moves to the next step on continue', () => {
    render(<Onboarding onComplete={vi.fn()} />);
    clickContinue();
    expect(screen.getByText('Never Miss a Dose')).toBeTruthy();
  });

  it('labels the final step as the finish action', () => {
    render(<Onboarding onComplete={vi.fn()} />);
    goToFinalStep();
    expect(screen.getByText('Get Started')).toBeTruthy();
  });

  it('reports completion once the final step is confirmed', () => {
    const onComplete = vi.fn();
    render(<Onboarding onComplete={onComplete} />);
    goToFinalStep();
    fireEvent.click(screen.getByText('Get Started'));
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it('records the onboarded flag when finished', () => {
    render(<Onboarding onComplete={vi.fn()} />);
    goToFinalStep();
    fireEvent.click(screen.getByText('Get Started'));
    expect(localStorage.getItem('pepdose-onboarded')).toBe('true');
  });

  it('records the onboarded flag when skipped from the first step', () => {
    render(<Onboarding onComplete={vi.fn()} />);
    fireEvent.click(screen.getByText('Skip'));
    expect(localStorage.getItem('pepdose-onboarded')).toBe('true');
  });
});
