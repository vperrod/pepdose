import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { format } from 'date-fns';
import { ArrowLeft, Check, X } from 'lucide-react';
import { PEPTIDES, getPeptideById, CATEGORY_LABELS, type Peptide } from '../data/peptides';
import { defaultCard, type CardValue } from '../utils/cycleForm';
import { PeptideCycleCard } from '../components/PeptideCycleCard';
import { DisclaimerFooter } from '../components/DisclaimerFooter';
import { UserPicker } from '../components/UserPicker';
import { getLastOwner, setLastOwner, type UserName } from '../data/users';
import { buildProtocolDraft, buildDoses, canSave } from '../utils/protocolFromCards';
import { saveProtocol, saveScheduledDoses } from '../db/operations';

export function AddPeptides() {
  const navigate = useNavigate();
  const location = useLocation();

  // State for cards and UI
  const [cards, setCards] = useState<CardValue[]>([]);
  const [search, setSearch] = useState('');
  const [addingAnother, setAddingAnother] = useState(false);
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [owner, setOwner] = useState<UserName>(getLastOwner());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Preselect peptides once on mount
  useEffect(() => {
    const ids = (location.state as { preselectPeptideIds?: string[] } | null)?.preselectPeptideIds;
    if (!ids?.length) return;
    const newCards = ids
      .map(getPeptideById)
      .filter((p): p is Peptide => !!p)
      .map(defaultCard);
    if (newCards.length > 0) {
      setCards(newCards);
      setAddingAnother(false);
      setSearch('');
    }
    navigate('.', { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const picking = cards.length === 0 || addingAnother;

  // Filtered peptides for search
  const filteredPeptides = useMemo(() => {
    let list = PEPTIDES;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.aliases.some(a => a.toLowerCase().includes(q))
      );
    }
    return list;
  }, [search]);

  // Helper to check if a peptide is already in cards
  const isCardPresent = (peptideId: string) => cards.some(c => c.peptideId === peptideId);

  // Handle peptide selection from search
  const selectPeptide = (peptide: Peptide) => {
    if (isCardPresent(peptide.id)) return;
    setCards([...cards, defaultCard(peptide)]);
    setAddingAnother(false);
    setSearch('');
  };

  // Remove a card
  const removeCard = (peptideId: string) => {
    setCards(cards.filter(c => c.peptideId !== peptideId));
  };

  // Update an existing card
  const updateCard = (peptideId: string, updates: Partial<CardValue>) => {
    setCards(cards.map(c => c.peptideId === peptideId ? { ...c, ...updates } : c));
  };

  // Save protocol
  const save = async () => {
    if (!canSave(cards)) return;
    setSaving(true);
    setSaveError(null);

    try {
      const draft = buildProtocolDraft(cards);
      const protocol = await saveProtocol({
        name: draft.name,
        peptideIds: draft.peptideIds,
        doses: draft.doses,
        startDate,
        durationWeeks: draft.durationWeeks,
        status: 'active',
        owner,
      });

      await saveScheduledDoses(buildDoses(draft, protocol.id, startDate), owner);
      setLastOwner(owner);
      navigate('/');
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Could not save — please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="safe-top px-5 pt-4 pb-8">
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={() => navigate(-1)}
          className="tap-target p-2 -ml-2 rounded-xl"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5 text-text-secondary" />
        </button>
        <h1 className="text-xl font-bold flex-1">Add Peptide</h1>
      </div>

      {picking ? (
        // Picking view
        <div>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search peptides..."
            className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/40 mb-3"
          />

          <div className="space-y-2">
            {filteredPeptides.map(peptide => {
              const isSelected = isCardPresent(peptide.id);
              return (
                <button
                  key={peptide.id}
                  onClick={() => selectPeptide(peptide)}
                  disabled={isSelected}
                  className={`card-glass w-full p-4 tap-target text-left ${isSelected ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary-dim flex items-center justify-center">
                      <Check className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{peptide.name}</p>
                      <p className="text-xs text-text-muted truncate">{CATEGORY_LABELS[peptide.category] ?? peptide.category}</p>
                    </div>
                    {isSelected && (
                      <X className="w-4 h-4 text-text-muted" />
                    )}
                  </div>
                </button>
              );
            })}
            {filteredPeptides.length === 0 && search && (
              <p className="text-center text-text-muted py-4">No peptides found</p>
            )}
          </div>

          {cards.length > 0 && (
            <button
              onClick={() => setAddingAnother(true)}
              className="w-full mt-4 py-3 bg-primary/10 text-primary rounded-xl font-medium"
            >
              Cancel
            </button>
          )}
        </div>
      ) : (
        // Card view
        <div>
          {cards.map(card => {
            const peptide = getPeptideById(card.peptideId);
            if (!peptide) return null;
            return (
              <div key={card.peptideId} className="mb-4">
                <PeptideCycleCard
                  value={card}
                  peptide={peptide}
                  onChange={(newCard) => updateCard(card.peptideId, newCard)}
                  onRemove={() => {
                    if (cards.length > 1) removeCard(card.peptideId);
                  }}
                />
              </div>
            );
          })}

          <button
            onClick={() => setAddingAnother(true)}
            className="w-full py-3 bg-card border border-border rounded-xl font-medium text-text-secondary mb-4"
          >
            Add another peptide
          </button>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-muted mb-2">Start date</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full bg-card border border-border rounded-xl px-3 py-3 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/40"
                id="start-date"
              />
            </div>

            <UserPicker
              value={owner}
              onChange={setOwner}
              label="For"
            />

            <DisclaimerFooter className="mt-4" />

            <button
              onClick={save}
              disabled={!canSave(cards) || saving}
              className="w-full py-4 bg-primary text-bg rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>

            {saveError && (
              <div className="text-red-500 text-sm mt-2 text-center">
                {saveError}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}