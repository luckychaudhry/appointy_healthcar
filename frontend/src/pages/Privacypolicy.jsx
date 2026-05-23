import React from 'react'
import { assets } from '../assets/assets'

const Privacypolicy = () => {
    return (
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '40px 20px', lineHeight: '1.8' }}>
            <h1>Privacy Policy</h1>
            <p><strong>Last updated: {new Date().toLocaleDateString()}</strong></p>

            <section style={{ marginTop: '30px' }}>
                <h2>1. Introduction</h2>
                <p>
                    We are committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our application.
                </p>
            </section>

            <section style={{ marginTop: '30px' }}>
                <h2>2. Information We Collect</h2>
                <p>We may collect information about you in a variety of ways, including:</p>
                <ul>
                    <li><strong>Personal Data:</strong> Name, email address, phone number, appointment details</li>
                    <li><strong>Usage Data:</strong> IP address, browser type, pages visited, time spent on pages</li>
                    <li><strong>Cookies:</strong> We use cookies to enhance your experience</li>
                </ul>
            </section>

            <section style={{ marginTop: '30px' }}>
                <h2>3. How We Use Your Information</h2>
                <p>We use the information we collect to:</p>
                <ul>
                    <li>Provide and maintain our services</li>
                    <li>Send you service-related announcements</li>
                    <li>Respond to your inquiries</li>
                    <li>Improve our application</li>
                </ul>
            </section>

            <section style={{ marginTop: '30px' }}>
                <h2>4. Data Security</h2>
                <p>
                    We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.
                </p>
            </section>

            <section style={{ marginTop: '30px' }}>
                <h2>5. Your Rights</h2>
                <p>You have the right to:</p>
                <ul>
                    <li>Access your personal data</li>
                    <li>Request correction of inaccurate data</li>
                    <li>Request deletion of your data</li>
                </ul>
            </section>

            <section style={{ marginTop: '30px' }}>
                <h2>6. Contact Us</h2>
                <p>
                    If you have questions about this Privacy Policy, please contact us at: <strong>privacy@appointy.com</strong>
                </p>
            </section>
        </div>
    );
};

export default Privacypolicy;