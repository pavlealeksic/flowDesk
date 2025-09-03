#!/usr/bin/env node

/**
 * Master Test Runner - Executes all test suites and generates final report
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

class MasterTestRunner {
    constructor() {
        this.testSuites = [
            {
                name: 'Basic CLI Functionality',
                script: 'comprehensive-cli-test.js',
                description: 'Tests basic CLI operations and responses'
            },
            {
                name: 'Advanced CLI Functions', 
                script: 'advanced-cli-test.js',
                description: 'Tests actual implemented CLI functions'
            },
            {
                name: 'Full Integration',
                script: 'full-integration-test.js', 
                description: 'Complete system integration testing'
            },
            {
                name: 'Desktop Communication',
                script: 'desktop-rust-communication-test.js',
                description: 'Tests desktop app wrapper communication'
            },
            {
                name: 'Error Handling & Stress',
                script: 'error-handling-stress-test.js',
                description: 'Error scenarios and performance stress testing'
            }
        ];
        
        this.results = [];
        this.startTime = Date.now();
    }

    async runTestSuite(suite) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`🧪 Running: ${suite.name}`);
        console.log(`📝 Description: ${suite.description}`);
        console.log(`📄 Script: ${suite.script}`);
        console.log(`${'='.repeat(60)}\n`);

        return new Promise((resolve) => {
            const startTime = Date.now();
            const child = spawn('node', [suite.script], {
                stdio: 'inherit', // Show output in real-time
                cwd: __dirname
            });

            child.on('close', (code) => {
                const endTime = Date.now();
                const duration = endTime - startTime;
                
                const result = {
                    name: suite.name,
                    script: suite.script,
                    description: suite.description,
                    exitCode: code,
                    success: code === 0,
                    duration: duration,
                    timestamp: new Date().toISOString()
                };

                console.log(`\n📊 ${suite.name} completed:`);
                console.log(`   Exit Code: ${code}`);
                console.log(`   Duration: ${duration}ms`);
                console.log(`   Status: ${code === 0 ? '✅ PASSED' : '❌ FAILED'}\n`);

                resolve(result);
            });

            child.on('error', (error) => {
                const endTime = Date.now();
                const duration = endTime - startTime;
                
                console.error(`❌ Error running ${suite.name}: ${error.message}\n`);
                
                resolve({
                    name: suite.name,
                    script: suite.script,
                    description: suite.description,
                    exitCode: 1,
                    success: false,
                    duration: duration,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            });
        });
    }

    async runAllTests() {
        console.log('🚀 FLOW DESK COMPREHENSIVE TEST SUITE');
        console.log('=====================================\n');
        console.log(`📅 Started: ${new Date().toISOString()}`);
        console.log(`🖥️  Platform: ${process.platform}`);
        console.log(`📦 Node.js: ${process.version}`);
        console.log(`📂 Working Dir: ${__dirname}`);
        console.log(`🧪 Test Suites: ${this.testSuites.length}\n`);

        // Run each test suite
        for (let i = 0; i < this.testSuites.length; i++) {
            const suite = this.testSuites[i];
            console.log(`\n[${i + 1}/${this.testSuites.length}] Starting ${suite.name}...`);
            
            const result = await this.runTestSuite(suite);
            this.results.push(result);

            // Brief pause between suites
            if (i < this.testSuites.length - 1) {
                console.log('⏸️  Brief pause before next suite...\n');
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        await this.generateFinalReport();
    }

    async generateFinalReport() {
        const endTime = Date.now();
        const totalDuration = endTime - this.startTime;
        
        console.log('\n' + '='.repeat(80));
        console.log('📊 FINAL TEST RESULTS SUMMARY');
        console.log('='.repeat(80));

        const passed = this.results.filter(r => r.success).length;
        const failed = this.results.filter(r => !r.success).length;
        const total = this.results.length;
        const successRate = total > 0 ? (passed / total * 100).toFixed(1) : 0;

        console.log(`\n📈 OVERALL RESULTS:`);
        console.log(`   ✅ Passed: ${passed}/${total} test suites`);
        console.log(`   ❌ Failed: ${failed}/${total} test suites`);
        console.log(`   📊 Success Rate: ${successRate}%`);
        console.log(`   ⏱️  Total Duration: ${(totalDuration / 1000).toFixed(1)}s`);

        console.log(`\n📝 SUITE-BY-SUITE RESULTS:`);
        this.results.forEach((result, index) => {
            const icon = result.success ? '✅' : '❌';
            const duration = (result.duration / 1000).toFixed(1);
            console.log(`   ${icon} ${index + 1}. ${result.name} (${duration}s)`);
            if (result.error) {
                console.log(`      └─ Error: ${result.error}`);
            }
        });

        // Performance Analysis
        const totalTestTime = this.results.reduce((sum, r) => sum + r.duration, 0);
        const avgSuiteTime = totalTestTime / this.results.length;
        
        console.log(`\n⚡ PERFORMANCE ANALYSIS:`);
        console.log(`   Average Suite Time: ${(avgSuiteTime / 1000).toFixed(1)}s`);
        console.log(`   Longest Suite: ${Math.max(...this.results.map(r => r.duration / 1000)).toFixed(1)}s`);
        console.log(`   Shortest Suite: ${Math.min(...this.results.map(r => r.duration / 1000)).toFixed(1)}s`);

        // Generate comprehensive JSON report
        const report = {
            testRun: {
                timestamp: new Date().toISOString(),
                totalDuration: totalDuration,
                platform: process.platform,
                nodeVersion: process.version,
                workingDirectory: __dirname
            },
            summary: {
                total: total,
                passed: passed,
                failed: failed,
                successRate: parseFloat(successRate),
                avgSuiteTime: avgSuiteTime
            },
            suites: this.results,
            conclusions: {
                overallStatus: failed === 0 ? 'PASSED' : 'FAILED',
                productionReady: failed === 0,
                criticalIssues: failed,
                recommendation: failed === 0 ? 'APPROVED FOR PRODUCTION' : 'REQUIRES FIXES BEFORE DEPLOYMENT'
            }
        };

        const reportPath = path.join(__dirname, 'FINAL_TEST_RESULTS.json');
        await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

        console.log(`\n📄 Detailed report saved to: ${reportPath}`);

        // Final Assessment
        console.log(`\n🎯 FINAL ASSESSMENT:`);
        
        if (failed === 0) {
            console.log('🎉 EXCELLENT! All test suites passed successfully.');
            console.log('✨ The Flow Desk Rust integration is production-ready.');
            console.log('🚀 Deployment is approved with high confidence.');
        } else if (failed <= 1) {
            console.log('⚠️  GOOD! Minor issues detected but overall quality is high.');
            console.log('🛠️  Fix the failing suite and you\'re ready for production.');
        } else {
            console.log('🚨 ATTENTION REQUIRED! Multiple test suites failed.');
            console.log('🔧 Significant issues need to be addressed before deployment.');
        }

        console.log(`\n📋 NEXT STEPS:`);
        if (failed === 0) {
            console.log('1. Review comprehensive test report (COMPREHENSIVE_TEST_REPORT.md)');
            console.log('2. Complete OAuth client registration');
            console.log('3. Set up production database initialization');
            console.log('4. Deploy with confidence!');
        } else {
            console.log('1. Review failed test suite outputs above');
            console.log('2. Fix identified issues');
            console.log('3. Re-run tests until all pass');
            console.log('4. Then proceed with deployment');
        }

        console.log('\n' + '='.repeat(80));
        console.log('🏁 COMPREHENSIVE TESTING COMPLETE');
        console.log('='.repeat(80));

        // Exit with appropriate code
        process.exit(failed > 0 ? 1 : 0);
    }
}

// Run all tests if this script is executed directly
if (require.main === module) {
    const runner = new MasterTestRunner();
    runner.runAllTests().catch(error => {
        console.error('💥 Master test runner crashed:', error);
        process.exit(1);
    });
}

module.exports = { MasterTestRunner };