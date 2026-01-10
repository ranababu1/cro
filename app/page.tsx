import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-base-300">
      {/* Hero Section */}
      <div className="hero min-h-screen">
        <div className="hero-content text-center">
          <div className="max-w-4xl">
            <h1 className="text-6xl font-bold mb-6 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Self-Hosted A/B Testing Platform
            </h1>
            <p className="text-xl mb-8 text-base-content/80">
              Powerful, cost-efficient A/B testing with deterministic user assignment and statistical rigor.
              Deploy on your infrastructure, own your data.
            </p>

            <div className="flex gap-4 justify-center mb-12">
              <Link href="/dashboard" className="btn btn-primary btn-lg">
                Get Started
              </Link>
              <a href="#features" className="btn btn-outline btn-lg">
                Learn More
              </a>
            </div>

            {/* Stats */}
            <div className="stats stats-vertical lg:stats-horizontal shadow-xl bg-base-100">
              <div className="stat">
                <div className="stat-title">Deterministic</div>
                <div className="stat-value text-primary">100%</div>
                <div className="stat-desc">Consistent assignments</div>
              </div>
              <div className="stat">
                <div className="stat-title">Statistical</div>
                <div className="stat-value text-secondary">Rigorous</div>
                <div className="stat-desc">Wilson score intervals</div>
              </div>
              <div className="stat">
                <div className="stat-title">Cost</div>
                <div className="stat-value text-accent">$0</div>
                <div className="stat-desc">Self-hosted, open source</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div id="features" className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-12">Features</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h3 className="card-title text-2xl">
                  <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  Deterministic Assignment
                </h3>
                <p>SHA-256 hashing ensures users always see the same variation across sessions and devices.</p>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h3 className="card-title text-2xl">
                  <svg className="w-8 h-8 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Statistical Rigor
                </h3>
                <p>Wilson score confidence intervals and two-proportion z-tests for accurate significance testing.</p>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h3 className="card-title text-2xl">
                  <svg className="w-8 h-8 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                  </svg>
                  Self-Hosted
                </h3>
                <p>Deploy on Vercel + Cloudflare D1 or your own infrastructure. You own your data.</p>
              </div>
            </div>

            {/* Feature 4 */}
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h3 className="card-title text-2xl">
                  <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Lightweight SDK
                </h3>
                <p>Vanilla JavaScript SDK with localStorage caching. No heavy dependencies.</p>
              </div>
            </div>

            {/* Feature 5 */}
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h3 className="card-title text-2xl">
                  <svg className="w-8 h-8 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Cost Efficient
                </h3>
                <p>Free to run on free tiers. Cloudflare D1 provides generous limits for most use cases.</p>
              </div>
            </div>

            {/* Feature 6 */}
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h3 className="card-title text-2xl">
                  <svg className="w-8 h-8 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                  Developer Friendly
                </h3>
                <p>RESTful API, TypeScript support, and comprehensive documentation.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-20 px-4 bg-base-200">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-6">Ready to start testing?</h2>
          <p className="text-xl mb-8 text-base-content/80">
            Sign in with Google to create your first A/B test in minutes.
          </p>
          <Link href="/dashboard" className="btn btn-primary btn-lg">
            Create Your First Test
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="footer footer-center p-10 bg-base-300 text-base-content">
        <div>
          <p className="font-bold text-lg">CRO Platform</p>
          <p>Self-hosted A/B testing for modern teams</p>
          <p className="text-sm opacity-60">Built with Next.js, Tailwind CSS, and daisyUI</p>
        </div>
      </footer>
    </div>
  );
}
