'use client';

import { useEffect } from 'react';

import type { ReactNode } from 'react';

// Everything here is progressive enhancement: without JS or under reduced motion the page is
// fully visible, and hidden states are only applied by gsap.set to elements that are off-screen.
export function PageMotion(): ReactNode {
  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | null = null;
    const root = document.documentElement;

    const releaseHero = (): void => {
      root.classList.remove('hero-pending');
    };
    // If GSAP is not ready in time the hero is simply shown; replaying it later would flicker.
    let heroExpired = false;
    const guard = window.setTimeout(() => {
      heroExpired = true;
      releaseHero();
    }, 2500);

    const setup = async (): Promise<void> => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([
        import('gsap'),
        import('gsap/ScrollTrigger'),
      ]);
      if (disposed) {
        return;
      }
      gsap.registerPlugin(ScrollTrigger);

      const hidden = new Set<Element>();
      const revealAll = (): void => {
        hidden.forEach((el) => {
          gsap.set(el, { clearProps: 'opacity,transform,visibility' });
        });
        hidden.clear();
      };
      const offscreen = (el: Element): boolean =>
        el.getBoundingClientRect().top > window.innerHeight * 0.92;
      const hide = (targets: Element[], vars: gsap.TweenVars): Element[] => {
        const list = targets.filter(offscreen);
        list.forEach((el) => hidden.add(el));
        if (list.length) {
          gsap.set(list, vars);
        }
        return list;
      };
      const shown = (list: Element[]): void => {
        list.forEach((el) => hidden.delete(el));
      };
      const all = (selector: string): Element[] => Array.from(document.querySelectorAll(selector));

      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        // Hero: one rehearsed sequence on load.
        if (!heroExpired) {
          const heroText = all(
            '[data-hero="eyebrow"], [data-hero="title"], [data-hero="subtitle"], [data-hero="cta"]',
          );
          const phones = all('[data-hero="phone"]');
          const orderedPhones = [phones[1], phones[0], phones[2]].filter(Boolean);
          gsap.set(heroText, { opacity: 0, y: 24 });
          gsap.set(orderedPhones, { opacity: 0, y: 90 });
          releaseHero();
          const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
          tl.to(heroText, { opacity: 1, y: 0, duration: 0.7, stagger: 0.12 }, 0.05)
            .to(orderedPhones, { opacity: 1, y: 0, duration: 0.95, stagger: 0.14 }, 0.45)
            .set([...heroText, ...orderedPhones], { clearProps: 'opacity,transform' });
        }

        // Features batch in as a grid.
        const features = hide(all('[data-feature]'), { opacity: 0, y: 36 });
        if (features.length) {
          ScrollTrigger.batch(features, {
            start: 'top 90%',
            once: true,
            onEnter: (batch) => {
              shown(batch);
              gsap.to(batch, {
                opacity: 1,
                y: 0,
                duration: 0.7,
                ease: 'power3.out',
                stagger: 0.09,
                clearProps: 'transform,opacity',
              });
            },
          });
        }

        // Steps in sequence, with the connector line drawing.
        const steps = all('[data-step]');
        const line = document.querySelector('[data-step-line]');
        const stepsHidden = hide(steps, { opacity: 0, y: 32 });
        const lineHidden = line ? hide([line], { scaleX: 0 }) : [];
        if (stepsHidden.length) {
          ScrollTrigger.create({
            trigger: steps[0],
            start: 'top 85%',
            once: true,
            onEnter: () => {
              shown(stepsHidden);
              shown(lineHidden);
              const stepTl = gsap.timeline({ defaults: { ease: 'power3.out' } });
              if (lineHidden.length) {
                stepTl.to(lineHidden, { scaleX: 1, duration: 1.1, ease: 'power2.inOut' }, 0);
              }
              stepTl.to(
                stepsHidden,
                { opacity: 1, y: 0, duration: 0.6, stagger: 0.28, clearProps: 'transform,opacity' },
                0.1,
              );
            },
          });
        }

        // Pricing cards settle; the annual card arrives last.
        const cards = all('[data-price-card]');
        const featured = cards.filter((c) => c.hasAttribute('data-price-featured'));
        const plain = cards.filter((c) => !c.hasAttribute('data-price-featured'));
        const cardsHidden = hide([...plain, ...featured], { opacity: 0, y: 44 });
        if (cardsHidden.length) {
          ScrollTrigger.create({
            trigger: cards[0].parentElement ?? cards[0],
            start: 'top 88%',
            once: true,
            onEnter: () => {
              shown(cardsHidden);
              gsap.to(cardsHidden, {
                opacity: 1,
                y: 0,
                duration: 0.75,
                ease: 'back.out(1.3)',
                stagger: 0.12,
                clearProps: 'transform,opacity',
              });
            },
          });
        }

        // Closing card scales in.
        const closing = document.querySelector('[data-closing-card]');
        if (closing) {
          const closingHidden = hide([closing], { opacity: 0, scale: 0.94, y: 24 });
          if (closingHidden.length) {
            ScrollTrigger.create({
              trigger: closing,
              start: 'top 90%',
              once: true,
              onEnter: () => {
                shown(closingHidden);
                gsap.to(closing, {
                  opacity: 1,
                  scale: 1,
                  y: 0,
                  duration: 0.9,
                  ease: 'power3.out',
                  clearProps: 'transform,opacity',
                });
              },
            });
          }
        }

        // Pain, headings and misc blocks: a light fade only.
        const fades = hide([...all('[data-fade]'), ...all('[data-pain]')], { opacity: 0, y: 16 });
        fades.forEach((el) => {
          ScrollTrigger.create({
            trigger: el,
            start: 'top 92%',
            once: true,
            onEnter: () => {
              shown([el]);
              gsap.to(el, {
                opacity: 1,
                y: 0,
                duration: 0.6,
                ease: 'power2.out',
                clearProps: 'transform,opacity',
              });
            },
          });
        });

        const failsafe = window.setTimeout(() => {
          hidden.forEach((el) => {
            if (el.getBoundingClientRect().top < window.innerHeight) {
              gsap.set(el, { clearProps: 'opacity,transform,visibility' });
              hidden.delete(el);
            }
          });
        }, 8000);
        window.addEventListener('beforeprint', revealAll);

        return () => {
          window.clearTimeout(failsafe);
          window.removeEventListener('beforeprint', revealAll);
          revealAll();
        };
      });

      // Cursor glow on feature cards, only for devices that can hover precisely.
      mm.add('(hover: hover) and (pointer: fine)', () => {
        const cleaners = all('[data-glow]').map((card) => {
          const el = card as HTMLElement;
          const move = (event: PointerEvent): void => {
            const rect = el.getBoundingClientRect();
            el.style.setProperty('--mx', `${event.clientX - rect.left}px`);
            el.style.setProperty('--my', `${event.clientY - rect.top}px`);
          };
          el.addEventListener('pointermove', move, { passive: true });
          return () => el.removeEventListener('pointermove', move);
        });
        return () => cleaners.forEach((fn) => fn());
      });

      mm.add('(prefers-reduced-motion: reduce)', () => {
        releaseHero();
      });

      cleanup = () => {
        mm.revert();
        ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
      };
    };

    setup().catch(() => {
      releaseHero();
    });

    return () => {
      disposed = true;
      window.clearTimeout(guard);
      cleanup?.();
    };
  }, []);

  return null;
}
