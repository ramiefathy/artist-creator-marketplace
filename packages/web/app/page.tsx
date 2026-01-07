import { ThemeShowcase } from '@/design-system/components/theme';
import { Container } from '@/design-system/components/layout';
import { Heading, Text } from '@/design-system/components/typography';
import { ButtonLink } from '@/design-system/components/primitives';
import styles from './page.module.css';

export default function HomePage() {
  return (
    <main className={styles.main}>
      <Container size="xl">
        <section className={styles.hero} data-flux-zone="hero">
          <Heading level={1} size="4xl" className={styles.title}>
            Where Artists &amp; Creators Make Music Viral
          </Heading>
          <Text size="lg" color="muted" className={styles.subtitle}>
            The marketplace connecting musicians with content creators for authentic promotion.
          </Text>
        </section>

        <section className={styles.themeSection} data-flux-zone="marketing">
          <Heading level={2} size="xl" className={styles.sectionTitle}>
            Choose your visual experience
          </Heading>
          <ThemeShowcase />
        </section>

        <section className={styles.cta} data-flux-zone="marketing">
          <ButtonLink href="/signup" size="lg">
            Get Started
          </ButtonLink>
          <ButtonLink href="/login" size="lg" variant="secondary">
            Log In
          </ButtonLink>
        </section>
      </Container>
    </main>
  );
}
