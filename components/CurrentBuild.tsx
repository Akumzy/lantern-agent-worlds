import type { GameProject } from '../lib/arcade';

export default function CurrentBuild({ project, onStartFresh }: {
  project: GameProject;
  onStartFresh: () => void;
}) {
  return (
    <section className="current-build" aria-label="Current game">
      <div className="current-build-heading">
        <div><span className="quiet-kicker">Current game</span><h2>{project.title}</h2></div>
        <button className="workbench-secondary" type="button" onClick={onStartFresh}>Start another game</button>
      </div>
      <div className="current-build-goal"><span>{project.ageBand} · {project.subject}</span><p>{project.learningGoal}</p></div>
      <details className="current-build-details" key={project.id}>
        <summary>Game details</summary>
        <p>{project.description}</p>
        <small>Revision {project.revision} · {project.status === 'review' ? 'Ready for human review' : 'Agent-created draft'} · {project.durationMinutes} min</small>
      </details>
    </section>
  );
}
