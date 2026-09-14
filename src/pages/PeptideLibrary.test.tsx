// @vitest-environment jsdom
// Pure client-side page: the logic worth covering is the search match (name,
// alias and mechanism), the category filter, the group-only-when-showing-all
// rule, and the accordion that reveals a peptide's detail block.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { PeptideLibrary } from './PeptideLibrary';

vi.mock('react-router', () => ({ useNavigate: () => vi.fn() }));

function renderPage() {
  render(<PeptideLibrary />);
}

function search(term: string) {
  fireEvent.change(screen.getByLabelText('Search peptides'), { target: { value: term } });
}

afterEach(cleanup);

describe('PeptideLibrary search', () => {
  it('matches a peptide by name', () => {
    renderPage();
    search('BPC-157');
    expect(screen.getByText('BPC-157')).toBeTruthy();
  });

  // BPC-157 lists 'PL 14736' as an alias; the name alone would not match it.
  it('matches a peptide by one of its aliases', () => {
    renderPage();
    search('PL 14736');
    expect(screen.getByText('BPC-157')).toBeTruthy();
  });

  it('tells the user when nothing matches', () => {
    renderPage();
    search('zzzznotapeptide');
    expect(screen.getByText('No peptides match your search.')).toBeTruthy();
  });
});

describe('PeptideLibrary category filter', () => {
  it('hides peptides outside the selected category', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'GLP-1 Agonists' }));
    expect(screen.queryByText('BPC-157')).toBeNull();
  });

  it('drops the category headings once a single category is selected', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Healing & Recovery' }));
    expect(screen.queryByText('Healing & Recovery', { selector: 'p' })).toBeNull();
  });
});

describe('PeptideLibrary detail accordion', () => {
  it('reveals the dose range when a peptide is expanded', () => {
    renderPage();
    search('BPC-157');
    fireEvent.click(screen.getByText('BPC-157'));
    expect(screen.getByText('200–800 mcg')).toBeTruthy();
  });

  // halfLifeHours is 0.25 for BPC-157 — sub-hour values render in minutes.
  it('renders a sub-hour half-life in minutes', () => {
    renderPage();
    search('BPC-157');
    const card = screen.getByText('BPC-157').closest('button')!;
    expect(within(card).getByText(/t½ 15min/)).toBeTruthy();
  });

  it('collapses an expanded peptide when tapped again', () => {
    renderPage();
    search('BPC-157');
    fireEvent.click(screen.getByText('BPC-157'));
    fireEvent.click(screen.getByText('BPC-157'));
    expect(screen.queryByText('200–800 mcg')).toBeNull();
  });
});
