"use client";
import { useEffect, useState } from "react";
import { ExplorePage, LinkButton } from "@/components/explore/ExplorePage";
import { api, API, type Paper, type Clock } from "@/lib/api";
import { Painting } from "@/components/Painting";
import s from "@/components/explore/explore.module.css";

export default function Gazette() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [papers, setPapers] = useState<Paper[]>([]);
  const [clock, setClock] = useState<Clock | null>(null);
  const [selected, setSelected] = useState(0);
  useEffect(() => {
    void api<Paper[]>("/api/papers").then(setPapers).catch(() => setError("The Gazette could not be reached. Please try again shortly.")).finally(() => setLoading(false));
    void api<Clock>("/api/town").then(setClock).catch(() => {});
  }, []);

  const paper = papers[selected];
  const sourceNote = (ids?: number[]) => ids?.length ? (
    <div className={s.paperSource}>Public record · {ids.map((id, index) => (
      <span key={id}>{index > 0 && ", "}<a href={`${API}/api/moments/${id}`} target="_blank" rel="noreferrer">#{id}</a></span>
    ))}</div>
  ) : null;

  return (
    <ExplorePage eyebrow="Written by the town" title="The Gazette" description="The island's public record, arranged as a daily front page." compact>
      {error && <p role="alert">{error}</p>}
      {loading && <p role="status" className="text-ink2">Opening the latest edition…</p>}
      {paper ? (
        <article className={s.newspaper} aria-label={`Gazette edition ${paper.edition}`}>
          <header className={s.paperMasthead}>
            <div className={s.paperTopline}><span>Unwatched · The island edition</span><span>Est. day one</span></div>
            <div className={s.paperName}>The Gazette</div>
            <div className={s.paperDateline}><span>Edition {paper.edition} · {paper.date}</span><span>Weather · {paper.weather}</span></div>
          </header>

          {papers.length > 1 && (
            <nav className={s.paperArchive} aria-label="Gazette editions">
              <span>Past editions</span>
              <div className={s.editionButtons}>{papers.map((edition, index) => (
                <button key={edition.edition} type="button" onClick={() => setSelected(index)} aria-label={`Read edition ${edition.edition}`} aria-pressed={index === selected}>{edition.edition}</button>
              ))}</div>
            </nav>
          )}

          <div className={s.frontGrid}>
            <section className={s.frontLead} aria-labelledby="lead-headline">
              <div className={s.paperRubric}>The lead story <span>01 / {paper.date}</span></div>
              <h2 id="lead-headline">{paper.lead.headline}</h2>
              <p className={s.paperDeck}>{paper.lead.deck}</p>
              {paper.scene && <figure className={s.paperFigure}><Painting scene={paper.scene} edition={paper.edition} /><figcaption>{paper.scene.caption}</figcaption></figure>}
              <p className={s.paperBody}>{paper.lead.body}</p>
              {sourceNote(paper.lead.sources)}
            </section>

            <aside className={s.frontRail} aria-label="More from this edition">
              <div className={s.paperRubric}>Also today</div>
              {paper.briefs.slice(0, 2).map((story, index) => (
                <section className={s.railStory} key={`${story.headline}-${index}`}>
                  <span className={s.storyNumber}>0{index + 2}</span>
                  <h3>{story.headline}</h3>
                  <p>{story.body}</p>
                  {sourceNote(story.sources)}
                </section>
              ))}
              <section className={s.paperNotices} aria-label="Notices">
                <div className={s.paperRubric}>Public notices</div>
                {paper.notices.map((notice, index) => <p key={index}>{notice}</p>)}
              </section>
            </aside>
          </div>

          {paper.briefs.length > 2 && (
            <section className={s.moreStories} aria-label="More stories">
              <div className={s.paperRubric}>Around the island</div>
              <div className={s.moreGrid}>{paper.briefs.slice(2).map((story, index) => (
                <section className={s.moreStory} key={`${story.headline}-${index}`}>
                  <span className={s.storyNumber}>0{index + 4}</span>
                  <h3>{story.headline}</h3><p>{story.body}</p>{sourceNote(story.sources)}
                </section>
              ))}</div>
            </section>
          )}

          {(paper.market || paper.harbor || paper.tomorrow) && (
            <section className={s.paperColumns} aria-label="Standing columns">
              {paper.market && <div><div className={s.paperRubric}>The shelf</div><p>{paper.market}</p></div>}
              {paper.harbor && <div><div className={s.paperRubric}>The harbor</div><p>{paper.harbor}</p></div>}
              {paper.tomorrow && <div><div className={s.paperRubric}>Tomorrow</div><p>{paper.tomorrow}</p></div>}
            </section>
          )}

          <footer className={s.paperFooter}>
            {paper.seal && <div className={s.sealNote}><strong>The day's seal</strong><p>The seal chains {paper.seal.events} events to the previous day. It checks the event record; it does not independently verify what a person said or observed.</p><code>{paper.seal.hash}</code><a href={`${API}/api/record`} target="_blank" rel="noreferrer">See the seal chain</a></div>}
            <div className={s.paperLinks}><span>Follow the island</span><LinkButton href="/library" kind="secondary" size={36}>The library</LinkButton><LinkButton href="/hall" kind="secondary" size={36}>The town hall</LinkButton><LinkButton href="/board" kind="tertiary" size={36}>Send someone over</LinkButton></div>
          </footer>
        </article>
      ) : !error && !loading && (
        <p className="text-drift">No edition yet. The first front page prints after day {clock?.day ?? 1} ends.</p>
      )}
    </ExplorePage>
  );
}
