export type KnockoutQuestion = {
  question: string;
  required?: boolean;
  rejectIfNo?: boolean;
};

export type RawJobData = Record<string, any>;

export type NormalizedJobData = {
  title: string;
  companyName: string;
  employerId: string | null;
  employerEmail: string | null;
  location: string;
  description: string;
  type: string;
  pricing: string | null;
  budgetCap: number | null;
  knockoutQuestions: KnockoutQuestion[];
  status: string;
};

function normalizeQuestions(input: unknown): KnockoutQuestion[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .filter((item): item is KnockoutQuestion => !!item && typeof item === 'object' && typeof (item as KnockoutQuestion).question === 'string')
    .map((item) => ({
      question: item.question,
      required: Boolean(item.required),
      rejectIfNo: Boolean(item.rejectIfNo),
    }));
}

function toNumberOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function normalizeJobData(raw: RawJobData): NormalizedJobData {
  return {
    title: typeof raw.title === 'string' ? raw.title : '',
    companyName:
      typeof raw.companyName === 'string' && raw.companyName
        ? raw.companyName
        : typeof raw.company === 'string' && raw.company
          ? raw.company
          : typeof raw.employerName === 'string' && raw.employerName
            ? raw.employerName
            : 'Company',
    employerId: typeof raw.employerId === 'string' && raw.employerId ? raw.employerId : null,
    employerEmail:
      typeof raw.employerEmail === 'string' && raw.employerEmail
        ? raw.employerEmail
        : typeof raw.companyEmail === 'string' && raw.companyEmail
          ? raw.companyEmail
          : null,
    location: typeof raw.location === 'string' ? raw.location : 'Malta',
    description: typeof raw.description === 'string' ? raw.description : '',
    type: typeof raw.type === 'string' && raw.type ? raw.type : 'full-time',
    pricing: typeof raw.pricing === 'string' && raw.pricing ? raw.pricing : null,
    budgetCap: toNumberOrNull(raw.budgetCap),
    knockoutQuestions: normalizeQuestions(raw.knockoutQuestions),
    status: typeof raw.status === 'string' && raw.status ? raw.status : 'active',
  };
}
