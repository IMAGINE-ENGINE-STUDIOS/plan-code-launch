import { motion } from 'framer-motion';
import { FileSearch, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import Navbar from '@/components/Navbar';
import { SupportLevelBadge } from '@/components/StatusBadge';
import { mockImportFindings } from '@/lib/mock-data';

const ImportReport = () => (
  <div className="min-h-screen bg-background">
    <Navbar />
    <div className="container max-w-3xl py-8">
      <Button variant="ghost" size="sm" className="mb-4" asChild>
        <Link to="/dashboard"><ArrowLeft className="mr-1 h-3.5 w-3.5" />Back</Link>
      </Button>

      <div className="mb-6 flex items-center gap-2">
        <FileSearch className="h-5 w-5 text-primary" />
        <h1 className="font-display text-xl font-bold">Import Compatibility Report</h1>
      </div>

      <p className="mb-6 text-sm text-muted-foreground">
        <strong>A</strong> = Fully supported · <strong>B</strong> = Partial support, migration needed · <strong>C</strong> = Manual review required
      </p>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Category</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Item</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Level</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Notes</th>
            </tr>
          </thead>
          <tbody>
            {mockImportFindings.map((f, i) => (
              <motion.tr
                key={i}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.05 }}
                className="border-b border-border last:border-0"
              >
                <td className="px-4 py-3 font-medium">{f.category}</td>
                <td className="px-4 py-3 font-mono text-xs">{f.item}</td>
                <td className="px-4 py-3"><SupportLevelBadge level={f.level} /></td>
                <td className="px-4 py-3 text-muted-foreground">{f.note}</td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

export default ImportReport;
