/**
 * GuideOverlay - Step-by-step tutorial overlay
 * Uses localStorage to persist progress
 */
import React, { useState, useEffect } from 'react';
import './GuideOverlay.css';

export interface GuideStep {
  id: string;
  title: string;
  description: string;
  targetSelector?: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

const DEFAULT_STEPS: GuideStep[] = [
  {
    id: 'recruit',
    title: '🎮 Welcome!',
    description: 'Click the recruit button to recruit your first hero!',
    targetSelector: '.tk-hero-recruit-btn',
    position: 'bottom',
  },
  {
    id: 'detail',
    title: '📋 View Hero Details',
    description: 'Click a hero card to view detailed stats, skills and power.',
    targetSelector: '.tk-hero-card',
    position: 'right',
  },
  {
    id: 'enhance',
    title: '✅ Enhance Heroes',
    description: 'Spend gold to level up your heroes and increase their power!',
    targetSelector: '.tk-hero-detail-enhance-btn',
    position: 'top',
  },
  {
    id: 'formation',
    title: '⚔️ Form Teams',
    description: 'Create formations and assign heroes to build the strongest team!',
    targetSelector: '.tk-formation-panel',
    position: 'top',
  },
];

const GUIDE_KEY = 'tk-guide-progress';

function loadProgress(): number {
  try {
    const raw = localStorage.getItem(GUIDE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data.completed) return -1;
      return typeof data.step === 'number' ? data.step : 0;
    }
  } catch { /* ignore */ }
  return 0;
}

function saveProgress(step: number, completed: boolean): void {
  try {
    localStorage.setItem(GUIDE_KEY, JSON.stringify({ step, completed }));
  } catch { /* ignore */ }
}

interface GuideOverlayProps {
  steps?: GuideStep[];
  onComplete?: () => void;
  onSkip?: () => void;
}

const GuideOverlay: React.FC<GuideOverlayProps> = ({
  steps = DEFAULT_STEPS,
  onComplete,
  onSkip,
}) => {
  const [currentStep, setCurrentStep] = useState<number>(() => loadProgress());
  const [visible, setVisible] = useState(true);

  if (currentStep < 0 || steps.length === 0 || !visible) return null;

  const step = steps[currentStep];
  if (!step) return null;

  const isLastStep = currentStep >= steps.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      saveProgress(currentStep, true);
      setVisible(false);
      onComplete?.();
    } else {
      const next = currentStep + 1;
      setCurrentStep(next);
      saveProgress(next, false);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      const prev = currentStep - 1;
      setCurrentStep(prev);
      saveProgress(prev, false);
    }
  };

  const handleSkip = () => {
    saveProgress(currentStep, true);
    setVisible(false);
    onSkip?.();
  };

  const posClass = step.position
    ? 'tk-guide-tooltip--' + step.position
    : 'tk-guide-tooltip--center';

  return (
    <div className="tk-guide-overlay" role="dialog" aria-modal="true" aria-label="Tutorial">
      <div className="tk-guide-backdrop" onClick={handleSkip} />
      <div className={`tk-guide-tooltip ${posClass}`}>
        <h3 className="tk-guide-tooltip__title">{step.title}</h3>
        <p className="tk-guide-tooltip__desc">{step.description}</p>
        <div className="tk-guide-tooltip__actions">
          <button
            className="tk-guide-btn tk-guide-btn--skip"
            onClick={handleSkip}
          >
            Skip
          </button>
          {currentStep > 0 && (
            <button
              className="tk-guide-btn tk-guide-btn--prev"
              onClick={handlePrev}
            >
              Previous
            </button>
          )}
          <button
            className="tk-guide-btn tk-guide-btn--next"
            onClick={handleNext}
          >
            {isLastStep ? 'Finish' : 'Next'}
          </button>
        </div>
        <div className="tk-guide-tooltip__progress">
          {currentStep + 1} / {steps.length}
        </div>
      </div>
    </div>
  );
};

export default GuideOverlay;
