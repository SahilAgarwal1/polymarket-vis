// 

import React, { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import { readString } from 'react-papaparse';
import 'chart.js/auto';

const App = () => {
  const [dataFiles, setDataFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState('');
  const [priceData, setPriceData] = useState([]);
  const [orderBookData, setOrderBookData] = useState({});
  const [timestamps, setTimestamps] = useState([]);
  const [selectedTimestamp, setSelectedTimestamp] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [timeFilter, setTimeFilter] = useState('all');

  // Load the list of data files from the public folder
  useEffect(() => {
    const files = ["Aaron TaylorJohnson announced as next James Bond.csv", "Bundestag dissolved in 2024.csv", "Elon Musk out as Head of DOGE before July.csv", "Elon Musk out as Head of DOGE before July copy.csv", "Google forced to sell Chrome.csv", "OpenSea token in 2024.csv", "Trump ends Ukraine war by first 90 days.csv", "Will Bayer Leverkusen win the UEFA Champions League.csv", "Will Bitcoin hit 100k in November.csv", "Will Bitcoin reach 65000 in November.csv", "Will Fed cut interest rates 5 times in 2024.csv"];
    setDataFiles(files);
    setSelectedFile(files[0]);
  }, []);

  // Load CSV data when a file is selected
  useEffect(() => {
    if (selectedFile) {
      fetch(`/data/price_data/${selectedFile}`)
        .then(response => response.text())
        .then(csv => {
          const parsedData = readString(csv, { header: true }).data;
          setPriceData(
            parsedData.filter(row => row.bid && row.ask && row.profit) // Ensure valid rows
          );
        })
        .catch(err => console.error('Error loading data:', err));
    }
  }, [selectedFile]);

  // Load orderbook data
  useEffect(() => {
    fetch(`/data/orderbook_data/orderbook_data1.csv`)
      .then(response => response.text())
      .then(csv => {
        const parsedData = readString(csv, { header: true }).data;

        // Group data by timestamps
        const groupedData = parsedData.reduce((acc, row) => {
          const timestamp = row.time;
          if (!acc[timestamp]) acc[timestamp] = [];
          acc[timestamp].push({
            price: parseFloat(row.price),
            volume: parseFloat(row.volume),
            side: row.side,
          });
          return acc;
        }, {});

        setOrderBookData(groupedData);
        setTimestamps(Object.keys(groupedData));
        setSelectedTimestamp(Object.keys(groupedData)[0]); // Default to first timestamp
      })
      .catch(err => console.error('Error loading CSV:', err));
  }, []);

  // Filter data based on selected time range
  const getFilteredData = () => {
    if (timeFilter === 'all') return priceData;

    const now = new Date();
    const filterTimes = {
      '24h': 24 * 60 * 60 * 1000,
      'week': 7 * 24 * 60 * 60 * 1000,
      'month': 30 * 24 * 60 * 60 * 1000
    };

    return priceData.filter(row => {
      const rowTime = new Date(row.time);
      return now - rowTime <= filterTimes[timeFilter];
    });
  };

  // Extract numerical data for charts
  const filteredData = getFilteredData();
  const numericalData = filteredData.map(row => ({
    bid: parseFloat(row.bid),
    ask: parseFloat(row.ask),
    midpoint: (parseFloat(row.bid) + parseFloat(row.ask)) / 2,
    profit: parseFloat(row.profit),
  }));

  // Calculate Y-axis range for price chart
  const allPriceValues = numericalData.flatMap(row => [
    row.bid,
    row.ask,
    row.midpoint,
  ]);
  const minPriceY = Math.min(...allPriceValues.filter(value => !isNaN(value)));
  const maxPriceY = Math.max(...allPriceValues.filter(value => !isNaN(value)));

  // Calculate Y-axis range for profit chart
  const allProfitValues = numericalData.map(row => row.profit);
  const minProfitY = Math.min(...allProfitValues.filter(value => !isNaN(value)));
  const maxProfitY = Math.max(...allProfitValues.filter(value => !isNaN(value)));

  // Process orderbook data
  const processOrderBookData = () => {
    if (!selectedTimestamp || !orderBookData[selectedTimestamp]) return { bids: [], asks: [] };

    const bids = [];
    const asks = [];
    let cumulativeBidVolume = 0;
    let cumulativeAskVolume = 0;

    // Get current midpoint price
    const currentData = orderBookData[selectedTimestamp];
    const midpoint = (Math.max(...currentData.filter(d => d.side === 'bid').map(d => d.price)) + 
                     Math.min(...currentData.filter(d => d.side === 'ask').map(d => d.price))) / 2;

    // Process bids (sort descending)
    const bidData = currentData
      .filter(d => d.side === 'bid')
      .sort((a, b) => b.price - a.price);

    // Process asks (sort ascending)
    const askData = currentData
      .filter(d => d.side === 'ask')
      .sort((a, b) => a.price - b.price);

    // Cumulate bids
    bidData.forEach(row => {
      if (row.price <= midpoint) {
        cumulativeBidVolume += row.volume;
        bids.push({ price: row.price, volume: cumulativeBidVolume });
      }
    });

    // Cumulate asks
    askData.forEach(row => {
      if (row.price >= midpoint) {
        cumulativeAskVolume += row.volume;
        asks.push({ price: row.price, volume: cumulativeAskVolume });
      }
    });

    return { bids: bids.reverse(), asks }; // Reverse bids for correct display
  };

  // Chart data for price
  const priceChartData = {
    labels: filteredData.map((row, index) => {
      const date = new Date(row.time);
      return `${date.toLocaleDateString()} ${date.getHours()}:00`;
    }),
    datasets: [
      {
        label: 'Bid',
        data: numericalData.map(row => row.bid),
        borderColor: '#2CE878',
        borderWidth: 1,
        fill: false,
      },
      {
        label: 'Ask',
        data: numericalData.map(row => row.ask),
        borderColor: '#FF4B4B',
        borderWidth: 1,
        fill: false,
      },
      {
        label: 'Midpoint',
        data: numericalData.map(row => row.midpoint),
        borderColor: '#3B82F6',
        borderWidth: 1,
        fill: false,
      },
      {
        label: 'Selected Point',
        data: numericalData.map((row, index) => 
          index === selectedIndex ? row.midpoint : null
        ),
        pointBackgroundColor: '#FFFFFF',
        pointRadius: 6,
        showLine: false
      }
    ],
  };

  // Chart data for profit
  const profitChartData = {
    labels: filteredData.map((row, index) => {
      const date = new Date(row.time);
      return `${date.toLocaleDateString()} ${date.getHours()}:00`;
    }),
    datasets: [
      {
        label: 'Profit',
        data: numericalData.map(row => row.profit),
        borderColor: '#8B5CF6',
        borderWidth: 1,
        fill: false,
      },
      {
        label: 'Selected Point',
        data: numericalData.map((row, index) => 
          index === selectedIndex ? row.profit : null
        ),
        pointBackgroundColor: '#FFFFFF',
        pointRadius: 6,
        showLine: false
      }
    ],
  };

  // Process depth chart data
  const { bids, asks } = processOrderBookData();
  const depthChartData = {
    labels: [...bids.map(bid => bid.price), ...asks.map(ask => ask.price)],
    datasets: [
      {
        label: 'Bids',
        data: [...bids.map(bid => bid.volume), ...Array(asks.length).fill(0)],
        borderColor:  '#2CE878',
        backgroundColor: 'rgba(44, 232, 120, 0.2)',
        fill: true,
        stepped: true,
      },
      {
        label: 'Asks',
        data: [...Array(bids.length).fill(0), ...asks.map(ask => ask.volume)],
        borderColor: '#FF4B4B',
        backgroundColor: 'rgba(255, 75, 75, 0.2)',
        fill: true,
        stepped: true,
      },
    ],
  };

  // Chart options
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: '#E5E7EB',
        },
      },
    },
    scales: {
      y: {
        grid: { color: '#374151' },
        ticks: { color: '#E5E7EB' },
      },
      x: {
        grid: { color: '#374151' },
        ticks: { color: '#E5E7EB' },
      },
    },
  };

  const buttonStyle = {
    backgroundColor: '#374151',
    color: '#E5E7EB',
    padding: '5px 10px',
    margin: '0 5px',
    border: '1px solid #4B5563',
    borderRadius: '4px',
    cursor: 'pointer'
  };

  const activeButtonStyle = {
    ...buttonStyle,
    backgroundColor: '#4B5563',
    borderColor: '#6B7280'
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#1F2937', color: '#E5E7EB' }}>
      <div style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1>Market Data Viewer</h1>
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
            <div>
              <strong>Bid:</strong> <span style={{color: '#2CE878'}}>{numericalData[selectedIndex]?.bid.toFixed(4)}</span>
            </div>
            <div>
              <strong>Midpoint:</strong> <span style={{color: '#3B82F6'}}>{numericalData[selectedIndex]?.midpoint.toFixed(4)}</span>
            </div>
            <div>
              <strong>Ask:</strong> <span style={{color: '#FF4B4B'}}>{numericalData[selectedIndex]?.ask.toFixed(4)}</span>
            </div>
            <div>
              <strong>Bid Volume:</strong> <span style={{color: '#F97316'}}>{bids[bids.length - 1]?.volume.toFixed(2)}</span>
            </div>
            <div>
              <strong>Ask Volume:</strong> <span style={{color: '#F97316'}}>{asks[asks.length - 1]?.volume.toFixed(2)}</span>
            </div>
            <div>
              <strong>Total Profit:</strong> <span style={{color: '#A855F7'}}>{numericalData[selectedIndex]?.profit.toFixed(4)}</span>
            </div>
          </div>
          <div style={{ width: '300px' }}>
            {timestamps.length > 0 && (
              <div>
                <input
                  type="range"
                  min="0"
                  max={timestamps.length - 1}
                  value={timestamps.indexOf(selectedTimestamp)}
                  onChange={e => {
                    setSelectedTimestamp(timestamps[e.target.value]);
                    setSelectedIndex(parseInt(e.target.value));
                  }}
                  style={{ width: '100%' }}
                />
                <div style={{ textAlign: 'center' }}>
                  {selectedTimestamp}
                </div>
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', marginTop: '10px', gap: '10px' }}>
          <label htmlFor="dataFile" style={{ marginRight: '10px' }}>
            Select Data File:
          </label>
          <select
            id="dataFile"
            value={selectedFile}
            onChange={e => setSelectedFile(e.target.value)}
            style={{
              backgroundColor: '#374151',
              color: '#E5E7EB',
              padding: '5px',
              borderRadius: '4px',
              border: '1px solid #4B5563',
            }}
          >
            {dataFiles.map(file => (
              <option key={file} value={file}>
                {file}
              </option>
            ))}
          </select>
          <div style={{ marginLeft: '20px' }}>
            <button 
              onClick={() => setTimeFilter('24h')}
              style={timeFilter === '24h' ? activeButtonStyle : buttonStyle}
            >
              Last 24 Hours
            </button>
            <button 
              onClick={() => setTimeFilter('week')}
              style={timeFilter === 'week' ? activeButtonStyle : buttonStyle}
            >
              Last Week
            </button>
            <button 
              onClick={() => setTimeFilter('month')}
              style={timeFilter === 'month' ? activeButtonStyle : buttonStyle}
            >
              Last Month
            </button>
            <button 
              onClick={() => setTimeFilter('all')}
              style={timeFilter === 'all' ? activeButtonStyle : buttonStyle}
            >
              All Data
            </button>
          </div>
        </div>
        <div style={{ marginTop: '20px', height: '400px' }}>
          <h2>Price Chart</h2>
          {numericalData.length > 0 ? (
            <Line data={priceChartData} options={chartOptions} />
          ) : (
            <p>No price data available to display.</p>
          )}
        </div>
        <div style={{ marginTop: '20px', display: 'flex', gap: '20px' }}>
          <div style={{ flex: 1, height: '400px' }}>
            <h2>Depth Chart</h2>
            {bids.length > 0 || asks.length > 0 ? (
              <Line data={depthChartData} options={chartOptions} />
            ) : (
              <p>No depth data available for the selected timestamp.</p>
            )}
          </div>
          <div style={{ flex: 1, height: '400px' }}>
            <h2>Profit Chart</h2>
            {numericalData.length > 0 ? (
              <Line data={profitChartData} options={chartOptions} />
            ) : (
              <p>No profit data available to display.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
