import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  AppState,
  View,
  Text,
  StyleSheet,
  TouchableNativeFeedback,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

function getHours(millis) {
  const hours = Math.floor(millis / 1000 / 3600);

  if (hours < 10) {
    return '0' + hours;
  } else {
    return `${hours}`;
  }
}

function getMinutes(millis) {
  const _seconds = (millis / 1000) % 3600;
  const minutes = Math.floor(_seconds / 60);

  if (minutes < 10) {
    return '0' + minutes;
  } else {
    return `${minutes}`;
  }
}

function getSeconds(millis) {
  let seconds = (millis / 1000) % 60;
  if (seconds < 10) {
    return '0' + Math.floor(seconds);
  } else {
    return `${Math.floor(seconds)}`;
  }
}

function Main() {
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [duration, setDuration] = useState(0);
  const [timeString, setTimeString] = useState('00:00:00');
  const intervalId = useRef(null);
  const initializedRef = useRef(false);

  const printTime = useCallback(
    (_duration, _startTime) => {
      if (!(_startTime || startTime)) {
        return;
      }

      const totalDuration =
        (_duration || duration) +
        Date.now() -
        (_startTime || startTime).getTime();
      const hours = getHours(totalDuration);
      const minutes = getMinutes(totalDuration);
      const seconds = getSeconds(totalDuration);

      setTimeString(`${hours}:${minutes}:${seconds}`);
    },
    [duration, startTime]
  );

  const tick = useCallback(() => {
    printTime();
  }, [printTime]);

  const tickRef = useRef(tick);
  tickRef.current = tick;

  const startTicking = useCallback(() => {
    intervalId.current = setInterval(() => {
      tickRef.current();
    }, 500);
  }, []);

  const handleStartClick = useCallback(async () => {
    try {
      const _startTime = new Date();
      await AsyncStorage.setItem('startTime', _startTime.toISOString());
      await AsyncStorage.setItem('started', JSON.stringify(true));
      setStartTime(_startTime);
      setStarted(!started);

      startTicking();
    } catch (err) {}
  }, [startTicking, started]);

  const handlePauseClick = useCallback(async () => {
    try {
      if (!paused) {
        const totalDuration = duration + Date.now() - startTime.getTime();
        setDuration(totalDuration);
        setStartTime(null);
        clearInterval(intervalId.current);

        await AsyncStorage.setItem('duration', JSON.stringify(totalDuration));
        await AsyncStorage.removeItem('startTime');
      } else {
        // Resume the timer
        const _startTime = new Date();
        await AsyncStorage.setItem('startTime', _startTime.toISOString());
        setStartTime(_startTime);

        startTicking();
      }

      await AsyncStorage.setItem('paused', JSON.stringify(!paused));
      setPaused(!paused);
    } catch (err) {
      console.log('Error in handlePauseClick()', err);
    }
  }, [duration, paused, startTicking, startTime]);

  const handleResetClick = useCallback(() => {
    Alert.alert('Reset timer?', 'This will reset your timer to zero.', [
      {
        text: 'Cancel',
        onPress: () => {},
        style: 'cancel',
      },
      {
        text: 'Reset',
        onPress: async () => {
          try {
            clearInterval(intervalId.current);

            await AsyncStorage.setItem('duration', JSON.stringify(0));
            await AsyncStorage.setItem('started', JSON.stringify(false));
            await AsyncStorage.setItem('paused', JSON.stringify(false));
            await AsyncStorage.removeItem('startTime');

            setPaused(false);
            setStarted(false);
            setStartTime(null);
            setDuration(0);
            setTimeString('00:00:00');
          } catch (err) {}
        },
      },
    ]);
  }, []);

  // Initialize values from storage
  useEffect(() => {
    (async () => {
      if (initializedRef.current) {
        return;
      }

      try {
        const _startTime = new Date(
          (await AsyncStorage.getItem('startTime')) || new Date()
        );
        const _started = JSON.parse(
          (await AsyncStorage.getItem('started')) || false
        );
        const _duration = parseInt(
          (await AsyncStorage.getItem('duration')) || '0',
          10
        );
        const _paused = JSON.parse(
          (await AsyncStorage.getItem('paused')) || false
        );

        setStarted(_started);
        setStartTime(_startTime);

        if (_duration) {
          setDuration(_duration);
        }

        setPaused(_paused);

        if (_started && !_paused) {
          startTicking();
        }

        if (_started && _duration && _startTime) {
          printTime(_duration, _startTime);
        }

        initializedRef.current = true;
      } catch (err) {
        console.log('Error initializing values from storage.', err);
      }
    })();
  }, [printTime, startTicking]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'background') {
        clearInterval(intervalId.current);
      } else if (nextAppState === 'active') {
        if (started && !paused) {
          printTime();
          startTicking();
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [paused, printTime, startTicking, started]);

  return (
    <View style={styles.container}>
      <View style={styles.timerContainer}>
        <Text
          style={{ ...styles.timer, ...(paused ? styles.timerPaused : {}) }}
        >
          {timeString}
        </Text>
      </View>

      <View style={styles.footer}>
        {started ? (
          <>
            <View style={styles.buttonContainer}>
              <TouchableNativeFeedback
                key="reset"
                background={TouchableNativeFeedback.Ripple('#fff', false)}
                onPress={handleResetClick}
              >
                <View style={styles.button}>
                  <Text style={styles.buttonText}>RESET</Text>
                </View>
              </TouchableNativeFeedback>
            </View>

            <View style={styles.buttonSeparator} />

            <View style={styles.buttonContainer}>
              <TouchableNativeFeedback
                key="pause"
                background={TouchableNativeFeedback.Ripple('#fff', false)}
                onPress={handlePauseClick}
              >
                <View style={styles.button}>
                  <Text style={styles.buttonText}>
                    {paused ? 'RESUME' : 'PAUSE'}
                  </Text>
                </View>
              </TouchableNativeFeedback>
            </View>
          </>
        ) : (
          <View style={styles.buttonContainer}>
            <TouchableNativeFeedback
              key="start"
              background={TouchableNativeFeedback.Ripple('#fff', false)}
              onPress={handleStartClick}
            >
              <View style={styles.button}>
                <Text style={styles.buttonText}>START</Text>
              </View>
            </TouchableNativeFeedback>
          </View>
        )}
      </View>
    </View>
  );
}

// Pink FF42A5
// Orange FF5722

const styles = StyleSheet.create({
  container: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  timerContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
  },
  timer: {
    paddingBottom: 200,
    fontSize: 80,
    color: '#222',
  },
  timerPaused: {
    color: '#f00',
    opacity: 0.4,
  },

  footer: {
    width: '100%',
    display: 'flex',
    flexDirection: 'row',
    padding: 16,
  },

  buttonContainer: {
    flex: 1,
    flexGrow: 1,
    overflow: 'hidden',
    borderRadius: 16,
    elevation: 4,
  },

  button: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    backgroundColor: '#222',
  },
  buttonText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },

  buttonSeparator: {
    width: 16,
  },
});

export default Main;
