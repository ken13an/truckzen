export default function TermsPage() {
  return (
    <div style={{ background: '#fff', minHeight: '100vh', color: '#111' }}>
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '48px 24px 80px' }}>
        <header style={{ marginBottom: 40 }}>
          <a href="https://truckzen.pro" style={{ textDecoration: 'none', color: '#111' }}>
            <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>TruckZen</h1>
          </a>
          <h2 style={{ fontSize: 24, fontWeight: 700, margin: '24px 0 8px' }}>Terms of Service</h2>
          <p style={{ fontSize: 14, color: '#666', margin: 0 }}>Last updated: March 2026</p>
        </header>

        <nav style={{ marginBottom: 40, padding: '20px 24px', background: '#f9fafb', borderRadius: 8 }}>
          <p style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px', color: '#333' }}>Table of Contents</p>
          <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 2, color: '#2563eb' }}>
            <li><a href="#service-description" style={{ color: '#2563eb', textDecoration: 'none' }}>Service Description</a></li>
            <li><a href="#account-responsibility" style={{ color: '#2563eb', textDecoration: 'none' }}>Account Responsibility</a></li>
            <li><a href="#acceptable-use" style={{ color: '#2563eb', textDecoration: 'none' }}>Acceptable Use</a></li>
            <li><a href="#payment-terms" style={{ color: '#2563eb', textDecoration: 'none' }}>Payment Terms</a></li>
            <li><a href="#data-ownership" style={{ color: '#2563eb', textDecoration: 'none' }}>Data Ownership</a></li>
            <li><a href="#service-availability" style={{ color: '#2563eb', textDecoration: 'none' }}>Service Availability</a></li>
            <li><a href="#limitation-of-liability" style={{ color: '#2563eb', textDecoration: 'none' }}>Limitation of Liability</a></li>
            <li><a href="#termination" style={{ color: '#2563eb', textDecoration: 'none' }}>Termination</a></li>
            <li><a href="#governing-law" style={{ color: '#2563eb', textDecoration: 'none' }}>Governing Law</a></li>
            <li><a href="#contact" style={{ color: '#2563eb', textDecoration: 'none' }}>Contact Us</a></li>
          </ol>
        </nav>

        <div style={{ fontSize: 16, lineHeight: 1.7, color: '#222' }}>
          <p>
            These Terms of Service (&quot;Terms&quot;) govern your access to and use of the TruckZen platform, including the website at truckzen.pro and associated mobile applications (collectively, the &quot;Service&quot;), operated by TruckZen (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;). By creating an account or using the Service, you agree to be bound by these Terms. If you do not agree, do not use the Service.
          </p>

          <h3 id="service-description" style={{ fontSize: 20, fontWeight: 700, marginTop: 40, marginBottom: 12 }}>1. Service Description</h3>
          <p>TruckZen is a cloud-based shop management platform designed for commercial truck repair facilities, fleet maintenance operations, and automotive service businesses. The Service provides tools for work order management, invoicing, parts inventory tracking, fleet and asset management, compliance monitoring, employee time tracking, customer relationship management, digital vehicle inspections (DVIR), and business reporting. The Service is provided on a software-as-a-service (SaaS) basis and is accessed through web browsers and mobile devices.</p>

          <h3 id="account-responsibility" style={{ fontSize: 20, fontWeight: 700, marginTop: 40, marginBottom: 12 }}>2. Account Responsibility</h3>
          <p>You must provide accurate, complete, and current information when creating an account. The account owner (typically the shop owner or general manager) is responsible for all activity that occurs under their organization&apos;s account, including activity by employees and team members they invite to the platform.</p>
          <p>You are responsible for maintaining the confidentiality of your login credentials. You must notify us immediately at support@truckzen.pro if you suspect unauthorized access to your account. We are not liable for any loss or damage arising from unauthorized use of your credentials.</p>
          <p>You may invite team members and assign roles with varying levels of access. You are responsible for ensuring that access permissions are appropriately configured and that team members comply with these Terms.</p>

          <h3 id="acceptable-use" style={{ fontSize: 20, fontWeight: 700, marginTop: 40, marginBottom: 12 }}>3. Acceptable Use</h3>
          <p>You agree to use the Service only for lawful purposes related to managing your business operations. You shall not:</p>
          <ul style={{ paddingLeft: 24, marginBottom: 16 }}>
            <li>Use the Service to store, transmit, or distribute any content that is unlawful, harmful, threatening, abusive, defamatory, or otherwise objectionable.</li>
            <li>Attempt to gain unauthorized access to any portion of the Service, other accounts, computer systems, or networks connected to the Service.</li>
            <li>Interfere with or disrupt the integrity or performance of the Service or its underlying infrastructure.</li>
            <li>Reverse engineer, decompile, disassemble, or otherwise attempt to derive the source code of the Service.</li>
            <li>Use the Service to send unsolicited commercial communications (spam) to your customers or any third parties.</li>
            <li>Resell, sublicense, or provide access to the Service to third parties without our prior written consent.</li>
            <li>Use automated scripts, bots, or scraping tools to extract data from the Service beyond what is available through our supported export features.</li>
          </ul>
          <p>We reserve the right to suspend or terminate accounts that violate these terms without prior notice.</p>

          <h3 id="payment-terms" style={{ fontSize: 20, fontWeight: 700, marginTop: 40, marginBottom: 12 }}>4. Payment Terms</h3>
          <p>Access to the Service requires a paid subscription. Subscription plans, pricing, and billing cycles are described on our website and within the Service. All fees are quoted in U.S. dollars unless otherwise stated.</p>
          <p>Subscriptions are billed in advance on a recurring basis (monthly or annually, depending on your selected plan). Payment is processed through Stripe, our third-party payment processor. By providing payment information, you authorize us to charge your payment method for all fees incurred.</p>
          <p>All fees are non-refundable except as required by law or as expressly stated in a separate written agreement. If you cancel your subscription, you will retain access to the Service through the end of your current billing period. No prorated refunds will be issued for partial billing periods.</p>
          <p>We reserve the right to change our pricing with 30 days&apos; prior notice. Price changes will take effect at the start of your next billing cycle following the notice period.</p>

          <h3 id="data-ownership" style={{ fontSize: 20, fontWeight: 700, marginTop: 40, marginBottom: 12 }}>5. Data Ownership</h3>
          <p>You retain all ownership rights to the data you enter into the Service (&quot;Your Data&quot;), including work orders, customer records, vehicle information, invoices, parts records, and any other business data. We do not claim ownership of Your Data.</p>
          <p>You grant us a limited, non-exclusive license to use, store, process, and display Your Data solely for the purpose of providing and improving the Service. This license terminates when you delete Your Data or close your account.</p>
          <p>You may export Your Data at any time using the export features provided within the Service. Upon account termination, we will make Your Data available for export for a period of 30 days, after which it may be permanently deleted.</p>
          <p>We may generate and use aggregated, anonymized, and de-identified data derived from Your Data for purposes such as analytics, benchmarking, and improving the Service. Such aggregated data will not identify you or your business.</p>

          <h3 id="service-availability" style={{ fontSize: 20, fontWeight: 700, marginTop: 40, marginBottom: 12 }}>6. Service Availability</h3>
          <p>We strive to maintain high availability of the Service but do not guarantee uninterrupted or error-free operation. The Service may be temporarily unavailable due to scheduled maintenance, software updates, infrastructure issues, or circumstances beyond our reasonable control.</p>
          <p>We will make commercially reasonable efforts to provide advance notice of scheduled maintenance that may affect Service availability. We are not liable for any damages resulting from Service downtime or interruptions.</p>

          <h3 id="limitation-of-liability" style={{ fontSize: 20, fontWeight: 700, marginTop: 40, marginBottom: 12 }}>7. Limitation of Liability</h3>
          <p>TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.</p>
          <p>IN NO EVENT SHALL TRUCKZEN, ITS OFFICERS, DIRECTORS, EMPLOYEES, OR AGENTS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, USE, OR GOODWILL, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF OR INABILITY TO USE THE SERVICE, REGARDLESS OF THE THEORY OF LIABILITY.</p>
          <p>OUR TOTAL AGGREGATE LIABILITY FOR ALL CLAIMS ARISING OUT OF OR RELATING TO THESE TERMS OR THE SERVICE SHALL NOT EXCEED THE AMOUNT YOU PAID TO US IN THE TWELVE (12) MONTHS IMMEDIATELY PRECEDING THE EVENT GIVING RISE TO THE CLAIM.</p>
          <p>TruckZen is a business management tool and does not provide legal, tax, financial, or regulatory compliance advice. You are solely responsible for ensuring that your business operations comply with all applicable laws and regulations, including DOT requirements, FMCSA regulations, and state automotive repair licensing requirements.</p>

          <h3 id="termination" style={{ fontSize: 20, fontWeight: 700, marginTop: 40, marginBottom: 12 }}>8. Termination</h3>
          <p>You may cancel your subscription and terminate your account at any time through the Service settings or by contacting us at support@truckzen.pro. Cancellation will take effect at the end of your current billing period.</p>
          <p>We may suspend or terminate your access to the Service immediately, without prior notice or liability, if you breach these Terms, fail to pay applicable fees, or engage in conduct that we determine, in our sole discretion, is harmful to the Service, other users, or our business interests.</p>
          <p>Upon termination, your right to use the Service will immediately cease. Sections of these Terms that by their nature should survive termination will survive, including but not limited to Data Ownership, Limitation of Liability, and Governing Law.</p>

          <h3 id="governing-law" style={{ fontSize: 20, fontWeight: 700, marginTop: 40, marginBottom: 12 }}>9. Governing Law</h3>
          <p>These Terms shall be governed by and construed in accordance with the laws of the State of Illinois, United States of America, without regard to its conflict of law provisions. Any legal action or proceeding arising out of or relating to these Terms or the Service shall be brought exclusively in the state or federal courts located in the State of Illinois, and you consent to the personal jurisdiction of such courts.</p>
          <p>Any dispute arising under these Terms shall first be subject to good-faith negotiation between the parties for a period of at least 30 days. If the dispute cannot be resolved through negotiation, either party may pursue resolution through the courts as described above.</p>

          <h3 id="contact" style={{ fontSize: 20, fontWeight: 700, marginTop: 40, marginBottom: 12 }}>10. Contact Us</h3>
          <p>If you have any questions about these Terms of Service, please contact us at:</p>
          <p>
            TruckZen<br />
            Email: <a href="mailto:support@truckzen.pro" style={{ color: '#2563eb' }}>support@truckzen.pro</a><br />
            Website: <a href="https://truckzen.pro" style={{ color: '#2563eb' }}>truckzen.pro</a>
          </p>
        </div>

        <footer style={{ marginTop: 60, paddingTop: 24, borderTop: '1px solid #e5e7eb', fontSize: 14, color: '#666' }}>
          <a href="https://truckzen.pro" style={{ color: '#2563eb', textDecoration: 'none' }}>Back to TruckZen</a>
          <span style={{ margin: '0 12px' }}>|</span>
          <a href="/privacy" style={{ color: '#2563eb', textDecoration: 'none' }}>Privacy Policy</a>
        </footer>
      </div>
    </div>
  )
}
