import { createContext, useContext, useState, type ReactNode } from 'react';
import type { WizardAnswers } from '@/lib/types';

interface WizardContextType {
  answers: WizardAnswers;
  setAnswers: (answers: WizardAnswers) => void;
}

const WizardContext = createContext<WizardContextType | null>(null);

export const WizardProvider = ({ children }: { children: ReactNode }) => {
  const [answers, setAnswers] = useState<WizardAnswers>({
    buildType: '',
    codeSource: '',
    priorities: [],
    dayOneFeatures: [],
  });

  return (
    <WizardContext.Provider value={{ answers, setAnswers }}>
      {children}
    </WizardContext.Provider>
  );
};

export const useWizard = () => {
  const ctx = useContext(WizardContext);
  if (!ctx) throw new Error('useWizard must be used within WizardProvider');
  return ctx;
};
