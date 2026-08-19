import Link from "next/link";
import {
  formatUsd,
  projectTotalUsd,
  showcaseProjects,
} from "@/lib/work";

export const metadata = {
  title: "Work — Altaris Labs",
  description:
    "Finished client work, shown with every milestone and the total cost to build it.",
};

export default function Page() {
  return (
    <section className="section work-page">
      <div className="container">
        <p className="eyebrow">Client work</p>
        <h2 className="work-heading">The catalog.</h2>
        <p className="large-copy work-intro">
          Finished apps, listed with every milestone and the total cost to build
          them. Altaris-owned products, including Ascent Games, are presented
          separately. This catalog is client work only, and only with permission.
        </p>

        {showcaseProjects.length === 0 ? (
          <div className="work-empty">
            <p className="eyebrow">No listings yet</p>
            <h3>The first projects will appear here.</h3>
            <p>
              As work is completed and clients opt in to a public listing, their
              apps and full milestone pricing will be added to this catalog.
            </p>
            <Link className="text-link" href="/services">
              How we build →
            </Link>
          </div>
        ) : (
          <div className="work-list">
            {showcaseProjects.map((project) => (
              <article key={project.slug} className="work-project">
                <div className="work-project-header">
                  <div>
                    <p className="eyebrow">{project.completed}</p>
                    <h3>{project.name}</h3>
                    <p>{project.summary}</p>
                  </div>
                  <p className="work-total">
                    <span>Total</span>
                    {formatUsd(projectTotalUsd(project))}
                  </p>
                </div>
                <table className="work-milestones">
                  <thead>
                    <tr>
                      <th>Milestone</th>
                      <th>What ships</th>
                      <th>Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {project.milestones.map((milestone) => (
                      <tr key={milestone.name}>
                        <td>{milestone.name}</td>
                        <td>{milestone.outcome}</td>
                        <td>{formatUsd(milestone.priceUsd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
