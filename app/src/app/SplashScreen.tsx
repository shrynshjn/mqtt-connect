import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Line, RadialGradient, Stop } from 'react-native-svg';
import BootSplash from 'react-native-bootsplash';
import { colors, font } from '../ui/theme';
import bootSplashManifest from '../../assets/bootsplash/manifest.json';

const MARK_SIZE = 220;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedLine = Animated.createAnimatedComponent(Line);

const CENTER = 100;
const RING_R = 25;
const RING_CIRC = 2 * Math.PI * RING_R;
const LINE_LEN_DIAG = Math.hypot(40, 40);
const LINE_LEN_STRAIGHT = 57;

const LINE_STAGGER = 85;
const LINE_DURATION = 320;
const RING_DELAY = 140;
const RING_DURATION = 420;
const NODE_DURATION = 270;
const NODE_TL_DELAY = 270;
const NODE_TR_DELAY = 340;
const NODE_B_DELAY = 410;
const DOT_DELAY = 550;
const DOT_DURATION = 230;
const WORDMARK_DURATION = 300;
const GLOW_START = DOT_DELAY + DOT_DURATION;
const GLOW_HALF_DURATION = 900;
const EXIT_DURATION = 270;

export function SplashScreen({
  exiting,
  onFinished,
}: {
  exiting: boolean;
  onFinished: () => void;
}) {
  const lineTL = useRef(new Animated.Value(0)).current;
  const lineTR = useRef(new Animated.Value(0)).current;
  const lineB = useRef(new Animated.Value(0)).current;
  const ring = useRef(new Animated.Value(0)).current;
  const nodeTL = useRef(new Animated.Value(0)).current;
  const nodeTR = useRef(new Animated.Value(0)).current;
  const nodeB = useRef(new Animated.Value(0)).current;
  const dot = useRef(new Animated.Value(0)).current;
  const wordmark = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;

  const [assembled, setAssembled] = useState(false);

  // Hides the native BootSplash (the static mark shown instantly on cold start, before
  // JS runs) the moment this view has laid out — since it renders the same mark on the
  // same background at the same spot, the swap is invisible and our draw-on animation
  // (already running from mount, below) just continues straight through it.
  const { container: bootSplashContainer } = BootSplash.useHideAnimation({
    manifest: bootSplashManifest,
    animate: () => {},
  });

  useEffect(() => {
    const drawLine = (value: Animated.Value, delay: number) =>
      Animated.timing(value, {
        toValue: 1,
        duration: LINE_DURATION,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      });

    const popNode = (value: Animated.Value, delay: number) =>
      Animated.timing(value, {
        toValue: 1,
        duration: NODE_DURATION,
        delay,
        easing: Easing.out(Easing.back(1.8)),
        useNativeDriver: false,
      });

    Animated.parallel([
      drawLine(lineTL, 0),
      drawLine(lineTR, LINE_STAGGER),
      drawLine(lineB, LINE_STAGGER * 2),
      Animated.timing(ring, {
        toValue: 1,
        duration: RING_DURATION,
        delay: RING_DELAY,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      popNode(nodeTL, NODE_TL_DELAY),
      popNode(nodeTR, NODE_TR_DELAY),
      popNode(nodeB, NODE_B_DELAY),
      popNode(dot, DOT_DELAY),
      Animated.timing(wordmark, {
        toValue: 1,
        duration: WORDMARK_DURATION,
        delay: GLOW_START,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => setAssembled(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!assembled) return;

    if (exiting) {
      Animated.timing(screenOpacity, {
        toValue: 0,
        duration: EXIT_DURATION,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(onFinished);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: GLOW_HALF_DURATION,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(glow, {
          toValue: 0,
          duration: GLOW_HALF_DURATION,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assembled, exiting]);

  const dashoffset = (progress: Animated.Value, length: number) =>
    progress.interpolate({ inputRange: [0, 1], outputRange: [length, 0] });

  const opacityOf = (progress: Animated.Value) =>
    progress.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    });

  const glowOpacity = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [0.28, 0.85],
  });

  return (
    <Animated.View
      pointerEvents={exiting ? 'none' : 'auto'}
      onLayout={bootSplashContainer.onLayout}
      style={[styles.root, { opacity: screenOpacity }]}
    >
      <Svg width={MARK_SIZE} height={MARK_SIZE} viewBox="0 0 200 200">
        <Defs>
          <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={colors.accent} stopOpacity={0.55} />
            <Stop offset="100%" stopColor={colors.accent} stopOpacity={0} />
          </RadialGradient>
        </Defs>

        <AnimatedLine
          x1={60}
          y1={60}
          x2={CENTER}
          y2={CENTER}
          stroke={colors.accentMuted}
          strokeWidth={7}
          strokeLinecap="round"
          strokeDasharray={`${LINE_LEN_DIAG}, ${LINE_LEN_DIAG}`}
          strokeDashoffset={dashoffset(lineTL, LINE_LEN_DIAG)}
        />
        <AnimatedLine
          x1={140}
          y1={60}
          x2={CENTER}
          y2={CENTER}
          stroke={colors.accentMuted}
          strokeWidth={7}
          strokeLinecap="round"
          strokeDasharray={`${LINE_LEN_DIAG}, ${LINE_LEN_DIAG}`}
          strokeDashoffset={dashoffset(lineTR, LINE_LEN_DIAG)}
        />
        <AnimatedLine
          x1={100}
          y1={157}
          x2={CENTER}
          y2={CENTER}
          stroke={colors.accentMuted}
          strokeWidth={7}
          strokeLinecap="round"
          strokeDasharray={`${LINE_LEN_STRAIGHT}, ${LINE_LEN_STRAIGHT}`}
          strokeDashoffset={dashoffset(lineB, LINE_LEN_STRAIGHT)}
        />

        <AnimatedCircle
          cx={CENTER}
          cy={CENTER}
          r={46}
          fill="url(#glow)"
          opacity={glowOpacity}
        />

        <AnimatedCircle
          cx={CENTER}
          cy={CENTER}
          r={RING_R}
          stroke={colors.white}
          strokeWidth={7}
          fill="none"
          strokeDasharray={`${RING_CIRC}, ${RING_CIRC}`}
          strokeDashoffset={dashoffset(ring, RING_CIRC)}
        />

        <AnimatedCircle
          cx={60}
          cy={60}
          r={13}
          fill={colors.white}
          origin="60, 60"
          scale={nodeTL}
          opacity={opacityOf(nodeTL)}
        />
        <AnimatedCircle
          cx={140}
          cy={60}
          r={13}
          fill={colors.white}
          origin="140, 60"
          scale={nodeTR}
          opacity={opacityOf(nodeTR)}
        />
        <AnimatedCircle
          cx={100}
          cy={157}
          r={13}
          fill={colors.white}
          origin="100, 157"
          scale={nodeB}
          opacity={opacityOf(nodeB)}
        />

        <AnimatedCircle
          cx={CENTER}
          cy={CENTER}
          r={3.4}
          fill={colors.white}
          origin={`${CENTER}, ${CENTER}`}
          scale={dot}
          opacity={opacityOf(dot)}
        />
      </Svg>

      <Animated.View style={[styles.wordmarkBlock, { opacity: wordmark }]}>
        <View style={styles.wordmarkRow}>
          <Animated.Text style={styles.wordmark}>MQTT </Animated.Text>
          <Animated.Text style={styles.wordmarkAccent}>Connect</Animated.Text>
        </View>
        <Animated.Text style={styles.subtext}>
          Secure, on-device MQTT clients
        </Animated.Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmarkBlock: {
    marginTop: 30,
    alignItems: 'center',
  },
  wordmarkRow: {
    flexDirection: 'row',
  },
  wordmarkAccent: {
    fontFamily: font.sans,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: 0.2,
    color: colors.accent,
  },
  wordmark: {
    fontFamily: font.sans,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: 0.2,
    color: colors.text,
  },
  subtext: {
    marginTop: 8,
    fontFamily: font.sans,
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.3,
    color: colors.textTertiary,
  },
});
