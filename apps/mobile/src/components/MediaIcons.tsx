import { StyleSheet, View } from 'react-native';

interface IconProps {
  color?: string;
  muted?: boolean;
}

export function MicSymbol({ color = '#FFFFFF', muted = false }: IconProps) {
  return (
    <View style={styles.box}>
      {/* Mic capsule */}
      <View style={[styles.micCapsule, { borderColor: color, backgroundColor: muted ? 'transparent' : color }]} />
      {/* Mic cradle U-arc */}
      <View style={[styles.micCradle, { borderColor: color }]} />
      {/* Stand stem + base */}
      <View style={[styles.micStem, { backgroundColor: color }]} />
      <View style={[styles.micBase, { backgroundColor: color }]} />
      {muted && <View style={[styles.slash, { backgroundColor: color }]} />}
    </View>
  );
}

export function CamSymbol({ color = '#FFFFFF', muted = false }: IconProps) {
  return (
    <View style={styles.box}>
      <View style={styles.camRow}>
        <View style={[styles.camBody, { borderColor: color, backgroundColor: muted ? 'transparent' : color }]} />
        <View
          style={[
            styles.camLens,
            {
              borderRightColor: color,
            },
          ]}
        />
      </View>
      {muted && <View style={[styles.slash, { backgroundColor: color }]} />}
    </View>
  );
}

export function SpeakerSymbol({ color = '#FFFFFF', muted = false }: IconProps) {
  return (
    <View style={styles.box}>
      <View style={styles.speakerRow}>
        <View style={[styles.speakerBack, { backgroundColor: color }]} />
        <View style={[styles.speakerCone, { borderRightColor: color }]} />
        {!muted && (
          <>
            <View style={[styles.waveInner, { borderColor: color }]} />
            <View style={[styles.waveOuter, { borderColor: color }]} />
          </>
        )}
      </View>
      {muted && <View style={[styles.slash, { backgroundColor: color }]} />}
    </View>
  );
}

export function FullscreenSymbol({
  color = '#FFFFFF',
  active = false,
}: {
  color?: string;
  active?: boolean;
}) {
  return (
    <View style={styles.box}>
      <View style={styles.fsWrap}>
        <View
          style={[
            styles.fsCorner,
            active ? styles.fsInTL : styles.fsOutTL,
            { borderColor: color },
          ]}
        />
        <View
          style={[
            styles.fsCorner,
            active ? styles.fsInTR : styles.fsOutTR,
            { borderColor: color },
          ]}
        />
        <View
          style={[
            styles.fsCorner,
            active ? styles.fsInBL : styles.fsOutBL,
            { borderColor: color },
          ]}
        />
        <View
          style={[
            styles.fsCorner,
            active ? styles.fsInBR : styles.fsOutBR,
            { borderColor: color },
          ]}
        />
      </View>
    </View>
  );
}

export function PeopleSymbol({ color = '#FFFFFF' }: { color?: string }) {
  return (
    <View style={styles.box}>
      <View style={[styles.personHead, { backgroundColor: color }]} />
      <View style={[styles.personShoulders, { borderColor: color }]} />
    </View>
  );
}

export function ChatSymbol({ color = '#FFFFFF' }: { color?: string }) {
  return (
    <View style={styles.box}>
      <View style={[styles.chatBody, { borderColor: color }]}>
        <View style={[styles.chatLine1, { backgroundColor: color }]} />
        <View style={[styles.chatLine2, { backgroundColor: color }]} />
      </View>
    </View>
  );
}

export function InviteSymbol({ color = '#FFFFFF' }: { color?: string }) {
  return (
    <View style={styles.box}>
      <View style={[styles.plusH, { backgroundColor: color }]} />
      <View style={[styles.plusV, { backgroundColor: color }]} />
    </View>
  );
}

export function EndCallSymbol({ color = '#FFFFFF' }: { color?: string }) {
  return (
    <View style={styles.box}>
      <View style={[styles.phoneArc, { borderColor: color }]} />
    </View>
  );
}

export function MoreDotsSymbol({ color = '#FFFFFF' }: { color?: string }) {
  return (
    <View style={[styles.box, { gap: 3.5 }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <View style={[styles.dot, { backgroundColor: color }]} />
      <View style={[styles.dot, { backgroundColor: color }]} />
    </View>
  );
}

export function FlipCamSymbol({ color = '#FFFFFF' }: { color?: string }) {
  return (
    <View style={styles.box}>
      {/* Sleek rounded camera frame with clean swap-arrows icon inside */}
      <View style={[styles.flipCamTopTab, { borderColor: color }]} />
      <View style={[styles.flipCamBody, { borderColor: color }]}>
        <View style={[styles.flipArcTop, { borderColor: color }]} />
        <View style={[styles.flipArcBottom, { borderColor: color }]} />
        <View style={[styles.flipTipRight, { borderTopColor: color, borderRightColor: color }]} />
        <View style={[styles.flipTipLeft, { borderBottomColor: color, borderLeftColor: color }]} />
      </View>
    </View>
  );
}

export function ScreenShareSymbol({ color = '#FFFFFF' }: { color?: string }) {
  return (
    <View style={styles.box}>
      <View style={[styles.screenFrame, { borderColor: color }]}>
        <View style={[styles.screenArrowHead, { borderTopColor: color, borderLeftColor: color }]} />
        <View style={[styles.screenArrowStem, { backgroundColor: color }]} />
      </View>
      <View style={[styles.screenStand, { backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  slash: {
    position: 'absolute',
    width: 24,
    height: 2.3,
    borderRadius: 2,
    transform: [{ rotate: '-45deg' }],
  },
  // Mic
  micCapsule: {
    width: 7,
    height: 11,
    borderRadius: 4,
    borderWidth: 1.8,
    marginBottom: -4,
  },
  micCradle: {
    width: 13,
    height: 8,
    borderBottomLeftRadius: 7,
    borderBottomRightRadius: 7,
    borderWidth: 1.8,
    borderTopWidth: 0,
  },
  micStem: {
    width: 1.8,
    height: 3.5,
  },
  micBase: {
    width: 8,
    height: 1.8,
    borderRadius: 1,
  },
  // Camera
  camRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  camBody: {
    width: 13,
    height: 11,
    borderRadius: 2.5,
    borderWidth: 1.8,
  },
  camLens: {
    width: 0,
    height: 0,
    marginLeft: 1,
    borderTopWidth: 4,
    borderBottomWidth: 4,
    borderRightWidth: 5.5,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  // Speaker
  speakerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  speakerBack: {
    width: 4,
    height: 7,
    borderTopLeftRadius: 1.5,
    borderBottomLeftRadius: 1.5,
  },
  speakerCone: {
    width: 0,
    height: 0,
    borderTopWidth: 6.5,
    borderBottomWidth: 6.5,
    borderRightWidth: 6.5,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    marginLeft: -1,
  },
  waveInner: {
    width: 4,
    height: 8,
    borderRightWidth: 1.8,
    borderRadius: 4,
    marginLeft: 2,
  },
  waveOuter: {
    width: 4,
    height: 13,
    borderRightWidth: 1.8,
    borderRadius: 6,
    marginLeft: 1,
  },
  // Fullscreen corners
  fsWrap: {
    width: 16,
    height: 16,
    position: 'relative',
  },
  fsCorner: {
    position: 'absolute',
    width: 5.5,
    height: 5.5,
  },
  fsOutTL: { top: 0, left: 0, borderTopWidth: 2, borderLeftWidth: 2 },
  fsOutTR: { top: 0, right: 0, borderTopWidth: 2, borderRightWidth: 2 },
  fsOutBL: { bottom: 0, left: 0, borderBottomWidth: 2, borderLeftWidth: 2 },
  fsOutBR: { bottom: 0, right: 0, borderBottomWidth: 2, borderRightWidth: 2 },
  fsInTL: { top: 0, left: 0, borderBottomWidth: 2, borderRightWidth: 2 },
  fsInTR: { top: 0, right: 0, borderBottomWidth: 2, borderLeftWidth: 2 },
  fsInBL: { bottom: 0, left: 0, borderTopWidth: 2, borderRightWidth: 2 },
  fsInBR: { bottom: 0, right: 0, borderTopWidth: 2, borderLeftWidth: 2 },
  // People
  personHead: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginBottom: 2,
  },
  personShoulders: {
    width: 15,
    height: 7,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderWidth: 2,
    borderBottomWidth: 0,
  },
  // Chat
  chatBody: {
    width: 17,
    height: 14,
    borderRadius: 4,
    borderWidth: 1.8,
    justifyContent: 'center',
    paddingHorizontal: 3,
    gap: 2.5,
  },
  chatLine1: {
    width: 8,
    height: 1.6,
    borderRadius: 1,
  },
  chatLine2: {
    width: 5,
    height: 1.6,
    borderRadius: 1,
  },
  // Invite (+)
  plusH: {
    position: 'absolute',
    width: 14,
    height: 2.2,
    borderRadius: 1.5,
  },
  plusV: {
    position: 'absolute',
    width: 2.2,
    height: 14,
    borderRadius: 1.5,
  },
  // End Call
  phoneArc: {
    width: 18,
    height: 8,
    borderTopLeftRadius: 9,
    borderTopRightRadius: 9,
    borderWidth: 3,
    borderBottomWidth: 0,
    marginTop: 4,
  },
  // More 3 dots
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  // Flip camera (modern camera + circular swap arrows)
  flipCamTopTab: {
    width: 8,
    height: 3.5,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    borderWidth: 1.6,
    borderBottomWidth: 0,
    marginBottom: -1,
  },
  flipCamBody: {
    width: 19,
    height: 14,
    borderRadius: 4,
    borderWidth: 1.7,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  flipArcTop: {
    position: 'absolute',
    width: 8.5,
    height: 8.5,
    borderRadius: 4.5,
    borderWidth: 1.5,
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
    transform: [{ rotate: '-35deg' }],
  },
  flipArcBottom: {
    position: 'absolute',
    width: 8.5,
    height: 8.5,
    borderRadius: 4.5,
    borderWidth: 1.5,
    borderTopColor: 'transparent',
    borderRightColor: 'transparent',
    transform: [{ rotate: '-35deg' }],
  },
  flipTipRight: {
    position: 'absolute',
    right: 3,
    top: 3,
    width: 3.2,
    height: 3.2,
    borderTopWidth: 1.5,
    borderRightWidth: 1.5,
    transform: [{ rotate: '45deg' }],
  },
  flipTipLeft: {
    position: 'absolute',
    left: 3,
    bottom: 3,
    width: 3.2,
    height: 3.2,
    borderBottomWidth: 1.5,
    borderLeftWidth: 1.5,
    transform: [{ rotate: '45deg' }],
  },
  // Screen Share (monitor + upward present arrow)
  screenFrame: {
    width: 19,
    height: 14,
    borderRadius: 3,
    borderWidth: 1.8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  screenArrowHead: {
    width: 5.5,
    height: 5.5,
    borderTopWidth: 1.8,
    borderLeftWidth: 1.8,
    transform: [{ rotate: '45deg' }],
    marginBottom: -4,
    marginTop: 1,
  },
  screenArrowStem: {
    width: 1.8,
    height: 6.5,
    borderRadius: 1,
  },
  screenStand: {
    width: 10,
    height: 2,
    borderRadius: 1,
    marginTop: 2.2,
  },
});
