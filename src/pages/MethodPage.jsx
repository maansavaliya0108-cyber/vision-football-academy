import { academy } from '../../shared/academy.js'
import { Link } from '../router'
import { Method } from '../site/Method'
import { Pathway } from '../site/Pathway'
import { Reputation } from '../site/Reputation'
import { CtaBand, PageHero } from './PageHero'

export default function MethodPage() {
  const { philosophy } = academy
  return (
    <>
      <PageHero crumbs={[{ label: 'The method' }]} title={philosophy.name} lede={philosophy.summary}>
        <Link className="btn btn--volt" to="/visit#join">
          Join the academy
        </Link>
        <Link className="btn btn--ghost" to="/programs">
          See the programs
        </Link>
      </PageHero>

      {/* The idea in one comparison: what most drills ask of a player, and what this method asks. */}
      <section className="contrast" aria-labelledby="contrast-title">
        <div className="wrap">
          <h2 id="contrast-title" className="section-title">
            Problems, not instructions
          </h2>
          <div className="contrast__grid">
            <div className="contrast__side">
              <p className="contrast__tag">Rigid drills</p>
              <p className="contrast__line">The coach explains the answer.</p>
              <p className="contrast__line">Players repeat it.</p>
              <p className="contrast__line">In a match, they look to the sideline.</p>
            </div>
            <div className="contrast__side contrast__side--on">
              <p className="contrast__tag">Guided self-discovery</p>
              <p className="contrast__line">The coach sets the problem.</p>
              <p className="contrast__line">Players work out the answer.</p>
              <p className="contrast__line">In a match, they read the game themselves.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="objective" aria-labelledby="objective-title">
        <div className="wrap">
          <h2 id="objective-title" className="visually-hidden">
            The objective
          </h2>
          <p className="objective__text">{philosophy.objective}</p>
        </div>
      </section>

      <Method />
      <Pathway />
      <Reputation />
      <CtaBand title="See it on the pitch" body="Sessions run Monday to Friday, 6 to 9 PM, at Boghara School Ground, Adajan." />
    </>
  )
}
