export type ShowcaseMilestone = {
  name: string;
  outcome: string;
  priceUsd: number;
};

export type ShowcaseProject = {
  slug: string;
  name: string;
  summary: string;
  completed: string;
  milestones: ShowcaseMilestone[];
};

/** Client projects that opted in to a public listing with full milestone pricing. */
export const showcaseProjects: ShowcaseProject[] = [];

export function projectTotalUsd(project: ShowcaseProject): number {
  return project.milestones.reduce((sum, milestone) => sum + milestone.priceUsd, 0);
}

export function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}
