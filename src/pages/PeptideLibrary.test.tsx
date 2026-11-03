// @vitest-environment jsdom
// Pure client-side page: the logic worth covering is the search match (name,
// alias and mechanism), the category filter, the group-only-when-showing-all
// rule, and the accordion that reveals a peptide's detail block.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
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
    search('Tirzepatide');
    expect(screen.getByText('Tirzepatide')).toBeTruthy();
  });

  // Tirzepatide lists 'Zepbound' as an alias; the name alone would not match it.
  it('matches a peptide by one of its aliases', () => {
    renderPage();
    search('Zepbound');
    expect(screen.getByText('Tirzepatide')).toBeTruthy();
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
    fireEvent.click(screen.getByRole('button', { name: 'Healing & Recovery' }));
    expect(screen.queryByText('Tirzepatide')).toBeNull();
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
    search('Tirzepatide');
    fireEvent.click(screen.getByText('Tirzepatide'));
    expect(screen.getByText('2.5–15 mg')).toBeTruthy();
  });


  it('collapses an expanded peptide when tapped again', () => {
    renderPage();
    search('Tirzepatide');
    fireEvent.click(screen.getByText('Tirzepatide'));
    fireEvent.click(screen.getByText('Tirzepatide'));
    expect(screen.queryByText('2.5–15 mg')).toBeNull();
  });
});
