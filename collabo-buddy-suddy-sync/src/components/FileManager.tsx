import React, { useState, useCallback, useEffect } from 'react';
import { Upload, Folder, File, Download, Trash2, MoreVertical, Search, Grid, List, Eye, FileText, Image, Video, Archive, Music, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useTheme } from '@/hooks/useTheme';

interface FileItem {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: Date;
  uploadedBy: string;
  folder?: string;
  tags: string[];
  url?: string;
  path?: string;
}

interface FileManagerProps {
  onFileUpload?: (files: File[]) => void;
  onFileDelete?: (fileId: string) => void;
  onFileDownload?: (fileId: string) => void;
  onFolderCreate?: (folderName: string) => void;
}

export const FileManager: React.FC<FileManagerProps> = ({
  onFileUpload,
  onFileDelete,
  onFileDownload,
  onFolderCreate
}) => {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string>('all');
  const [showUploadArea, setShowUploadArea] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [viewingFile, setViewingFile] = useState<FileItem | null>(null);
  const [showFolderDialog, setShowFolderDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  
  const { toast } = useToast();
  const { user } = useAuth();
  const { theme } = useTheme();

  const folders = ['Documents', 'Design', 'Images', 'Videos', 'Code', 'Audio'];

  // Load existing files from Supabase storage
  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = async () => {
    try {
      // List files from Supabase storage
      const { data, error } = await supabase.storage
        .from('project-files')
        .list('', {
          limit: 100,
          offset: 0,
        });

      if (error) {
        console.error('Error loading files:', error);
        return;
      }

      // Convert storage files to FileItem format
      const fileItems: FileItem[] = data.map((file) => ({
        id: file.id || file.name,
        name: file.name,
        size: file.metadata?.size || 0,
        type: getFileType(file.name),
        uploadedAt: new Date(file.updated_at || Date.now()),
        uploadedBy: user?.email || 'Unknown',
        folder: getFolderFromPath(file.name),
        tags: [],
        path: file.name,
        url: getFileUrl(file.name)
      }));

      setFiles(fileItems);
    } catch (error) {
      console.error('Error loading files:', error);
    }
  };

  const getFileType = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (['pdf', 'doc', 'docx'].includes(ext || '')) return 'document';
    if (['jpg', 'jpeg', 'png', 'gif', 'svg'].includes(ext || '')) return 'image';
    if (['mp4', 'avi', 'mov', 'wmv'].includes(ext || '')) return 'video';
    if (['mp3', 'wav', 'flac'].includes(ext || '')) return 'audio';
    if (['zip', 'rar', '7z'].includes(ext || '')) return 'archive';
    if (['js', 'ts', 'jsx', 'tsx', 'html', 'css'].includes(ext || '')) return 'code';
    return 'other';
  };

  const getFolderFromPath = (path: string): string => {
    const parts = path.split('/');
    return parts.length > 1 ? parts[0] : 'Root';
  };

  const getFileUrl = (path: string): string => {
    const { data } = supabase.storage
      .from('project-files')
      .getPublicUrl(path);
    return data.publicUrl;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const uploadedFiles: FileItem[] = [];

      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const fileName = `${selectedFolder === 'all' ? '' : selectedFolder + '/'}${file.name}`;
        
        // Upload to Supabase storage
        const { data, error } = await supabase.storage
          .from('project-files')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (error) {
          console.error('Upload error:', error);
          toast({
            title: "Upload Failed",
            description: `Failed to upload ${file.name}: ${error.message}`,
            variant: "destructive"
          });
          continue;
        }

        // Create file item
        const fileItem: FileItem = {
          id: data.path,
          name: file.name,
          size: file.size,
          type: getFileType(file.name),
          uploadedAt: new Date(),
          uploadedBy: user?.email || 'Unknown',
          folder: selectedFolder === 'all' ? 'Root' : selectedFolder,
          tags: [],
          path: data.path,
          url: getFileUrl(data.path)
        };

        uploadedFiles.push(fileItem);
        setUploadProgress(((i + 1) / selectedFiles.length) * 100);
      }

      // Update local state
      setFiles(prev => [...uploadedFiles, ...prev]);
      
      // Call callback
      onFileUpload?.(Array.from(selectedFiles));
      
      toast({
        title: "Upload Successful",
        description: `Successfully uploaded ${uploadedFiles.length} file(s)`,
      });

      setShowUploadArea(false);
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload Failed",
        description: "An error occurred during upload",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleFileDelete = async (fileId: string) => {
    try {
      const file = files.find(f => f.id === fileId);
      if (!file) return;

      // Delete from Supabase storage
      const { error } = await supabase.storage
        .from('project-files')
        .remove([file.path || file.name]);

      if (error) {
        console.error('Delete error:', error);
        toast({
          title: "Delete Failed",
          description: `Failed to delete ${file.name}`,
          variant: "destructive"
        });
        return;
      }

      // Remove from local state
      setFiles(prev => prev.filter(f => f.id !== fileId));
      onFileDelete?.(fileId);

      toast({
        title: "File Deleted",
        description: `${file.name} has been deleted`,
      });
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: "Delete Failed",
        description: "An error occurred while deleting the file",
        variant: "destructive"
      });
    }
  };

  const handleFileDownload = async (fileId: string) => {
    try {
      const file = files.find(f => f.id === fileId);
      if (!file || !file.url) return;

      // Create a temporary link and trigger download
      const link = document.createElement('a');
      link.href = file.url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      onFileDownload?.(fileId);
      toast({
        title: "Download Started",
        description: `Downloading ${file.name}`,
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: "Download Failed",
        description: "An error occurred while downloading the file",
        variant: "destructive"
      });
    }
  };

  const handleFileView = (file: FileItem) => {
    setViewingFile(file);
  };

  const handleFolderCreate = () => {
    if (!newFolderName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a folder name",
        variant: "destructive"
      });
      return;
    }

    if (folders.includes(newFolderName)) {
      toast({
        title: "Error",
        description: "Folder already exists",
        variant: "destructive"
      });
      return;
    }

    folders.push(newFolderName);
    onFolderCreate?.(newFolderName);
    toast({
      title: "Folder Created",
      description: `Folder "${newFolderName}" has been created`,
    });
    
    setNewFolderName('');
    setShowFolderDialog(false);
  };

  const filteredFiles = files.filter(file => {
    const matchesSearch = file.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         file.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesFolder = selectedFolder === 'all' || file.folder === selectedFolder;
    return matchesSearch && matchesFolder;
  });

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (type: string) => {
    const iconClass = "h-8 w-8";
    const isDark = theme === 'dark';
    
    switch (type) {
      case 'document':
        return <FileText className={`${iconClass} ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />;
      case 'image':
        return <Image className={`${iconClass} ${isDark ? 'text-green-400' : 'text-green-600'}`} />;
      case 'video':
        return <Video className={`${iconClass} ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />;
      case 'audio':
        return <Music className={`${iconClass} ${isDark ? 'text-pink-400' : 'text-pink-600'}`} />;
      case 'archive':
        return <Archive className={`${iconClass} ${isDark ? 'text-orange-400' : 'text-orange-600'}`} />;
      case 'code':
        return <File className={`${iconClass} ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`} />;
      default:
        return <File className={`${iconClass} ${isDark ? 'text-gray-400' : 'text-gray-600'}`} />;
    }
  };

  const canPreview = (type: string): boolean => {
    return ['image', 'document', 'video', 'audio'].includes(type);
  };

  const getStatusColor = (status: string) => {
    const isDark = theme === 'dark';
    switch (status) {
      case 'active': return isDark ? 'bg-green-500' : 'bg-green-100 text-green-800';
      case 'paused': return isDark ? 'bg-yellow-500' : 'bg-yellow-100 text-yellow-800';
      case 'stopped': return isDark ? 'bg-red-500' : 'bg-red-100 text-red-800';
      default: return isDark ? 'bg-gray-500' : 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
              File Manager
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mt-1">
              Organize and manage your project files with ease
            </p>
          </div>
          <Button 
            onClick={() => setShowUploadArea(true)} 
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
            size="lg"
          >
            <Upload className="h-5 w-5 mr-2" />
            Upload Files
          </Button>
        </div>
        
        {/* File Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                <File className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Files</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{files.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-green-200 dark:border-green-800">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-lg">
                <Folder className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Folders</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{folders.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
                <Image className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Images</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {files.filter(f => f.type === 'image').length}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-orange-200 dark:border-orange-800">
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/50 rounded-lg">
                <FileText className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Documents</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {files.filter(f => f.type === 'document').length}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Upload Area */}
      {showUploadArea && (
        <Card className="border-2 border-dashed border-blue-300 dark:border-blue-600 bg-blue-50/50 dark:bg-blue-950/20">
          <CardContent className="p-8">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center mb-4">
                <Upload className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {isUploading ? 'Uploading files...' : 'Drop files here or click to browse'}
                </p>
                {isUploading && (
                  <div className="mb-4">
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                      <div 
                        className="bg-gradient-to-r from-blue-500 to-indigo-500 h-3 rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
                      {Math.round(uploadProgress)}% complete
                    </p>
                  </div>
                )}
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Supports: PDF, DOC, DOCX, XLS, XLSX, Images, Videos, Audio, ZIP, RAR, Code files
                </p>
                <Input
                  type="file"
                  multiple
                  onChange={handleFileUpload}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar,.png,.jpg,.jpeg,.gif,.svg,.mp4,.avi,.mov,.mp3,.wav,.js,.ts,.jsx,.tsx,.html,.css"
                  className="max-w-xs mx-auto"
                  disabled={isUploading}
                />
              </div>
            </div>
            <div className="flex justify-center mt-4">
              <Button 
                onClick={() => setShowUploadArea(false)} 
                variant="outline"
                className="border-gray-300 dark:border-gray-600"
                disabled={isUploading}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Controls */}
      <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search files by name or tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600"
              />
            </div>

            <Select value={selectedFolder} onValueChange={setSelectedFolder}>
              <SelectTrigger className="w-48 bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600">
                <SelectValue placeholder="Select folder" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">📁 All Folders</SelectItem>
                {folders.map(folder => (
                  <SelectItem key={folder} value={folder}>
                    📁 {folder}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <Button
                className={`p-2 ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600'}`}
                onClick={() => setViewMode('grid')}
                title="Grid View"
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                className={`p-2 ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600'}`}
                onClick={() => setViewMode('list')}
                title="List View"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>

            <Button 
              onClick={() => setShowFolderDialog(true)} 
              variant="outline"
              className="border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Folder
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Files Display */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredFiles.map(file => (
            <Card key={file.id} className="group hover:shadow-lg transition-all duration-200 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  {getFileIcon(file.type)}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button className="bg-transparent hover:bg-gray-100 dark:hover:bg-gray-700 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreVertical className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                      {canPreview(file.type) && (
                        <DropdownMenuItem onClick={() => handleFileView(file)} className="hover:bg-gray-100 dark:hover:bg-gray-700">
                          <Eye className="h-4 w-4 mr-2 text-blue-600" />
                          <span className="text-gray-700 dark:text-gray-300">View</span>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => handleFileDownload(file.id)} className="hover:bg-gray-100 dark:hover:bg-gray-700">
                        <Download className="h-4 w-4 mr-2 text-green-600" />
                        <span className="text-gray-700 dark:text-gray-300">Download</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleFileDelete(file.id)} className="hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="space-y-2">
                  <h3 className="font-medium text-sm truncate text-gray-900 dark:text-white" title={file.name}>
                    {file.name}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{formatFileSize(file.size)}</p>
                  {file.folder && (
                    <Badge className="text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800">
                      <Folder className="h-3 w-3 mr-1" />
                      {file.folder}
                    </Badge>
                  )}
                  <div className="flex flex-wrap gap-1">
                    {file.tags.map(tag => (
                      <Badge key={tag} className="text-xs border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      📤 {file.uploadedBy}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      📅 {file.uploadedAt.toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-white">Files</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {filteredFiles.map(file => (
                <div key={file.id} className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg border border-gray-100 dark:border-gray-700 transition-colors">
                  <div className="flex items-center gap-3">
                    {getFileIcon(file.type)}
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">{file.name}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {formatFileSize(file.size)} • 📤 {file.uploadedBy} • 📅 {file.uploadedAt.toLocaleDateString()}
                      </p>
                      {file.folder && (
                        <Badge className="text-xs mt-1 bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800">
                          <Folder className="h-3 w-3 mr-1" />
                          {file.folder}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex flex-wrap gap-1">
                      {file.tags.map(tag => (
                        <Badge key={tag} className="text-xs border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button className="bg-transparent hover:bg-gray-100 dark:hover:bg-gray-700 p-2">
                          <MoreVertical className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                        {canPreview(file.type) && (
                          <DropdownMenuItem onClick={() => handleFileView(file)} className="hover:bg-gray-100 dark:hover:bg-gray-700">
                            <Eye className="h-4 w-4 mr-2 text-blue-600" />
                            <span className="text-gray-700 dark:text-gray-300">View</span>
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => handleFileDownload(file.id)} className="hover:bg-gray-100 dark:hover:bg-gray-700">
                          <Download className="h-4 w-4 mr-2 text-green-600" />
                          <span className="text-gray-700 dark:text-gray-300">Download</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleFileDelete(file.id)} className="hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {filteredFiles.length === 0 && (
        <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
          <CardContent className="p-12 text-center">
            <div className="mx-auto w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
              <File className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No files found</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Try adjusting your search or folder selection, or upload some files to get started!
            </p>
            <Button onClick={() => setShowUploadArea(true)} className="bg-blue-600 hover:bg-blue-700">
              <Upload className="h-4 w-4 mr-2" />
              Upload Your First File
            </Button>
          </CardContent>
        </Card>
      )}

      {/* New Folder Dialog */}
      {showFolderDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 border border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Create New Folder</h3>
              <Button onClick={() => setShowFolderDialog(false)} variant="ghost" size="sm">
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Folder Name
                </label>
                <Input
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Enter folder name..."
                  className="bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600"
                />
              </div>
              
              <div className="flex gap-2">
                <Button onClick={handleFolderCreate} className="flex-1">
                  <Folder className="h-4 w-4 mr-2" />
                  Create Folder
                </Button>
                <Button variant="outline" onClick={() => setShowFolderDialog(false)} className="flex-1">
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* File Preview Modal */}
      {viewingFile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-4xl max-h-[90vh] overflow-auto border border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{viewingFile.name}</h3>
              <Button onClick={() => setViewingFile(null)} variant="ghost">
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="space-y-4">
              {viewingFile.type === 'image' && viewingFile.url && (
                <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4">
                  <img 
                    src={viewingFile.url} 
                    alt={viewingFile.name} 
                    className="max-w-full h-auto rounded mx-auto"
                  />
                </div>
              )}
              
              {viewingFile.type === 'document' && viewingFile.url && (
                <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4">
                  <iframe
                    src={viewingFile.url}
                    className="w-full h-96 border-0 rounded"
                    title={viewingFile.name}
                  />
                </div>
              )}
              
              {viewingFile.type === 'video' && viewingFile.url && (
                <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4">
                  <video 
                    controls 
                    className="w-full h-auto rounded"
                    src={viewingFile.url}
                  >
                    Your browser does not support the video tag.
                  </video>
                </div>
              )}
              
              {viewingFile.type === 'audio' && viewingFile.url && (
                <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4">
                  <audio 
                    controls 
                    className="w-full"
                    src={viewingFile.url}
                  >
                    Your browser does not support the audio tag.
                  </audio>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4 text-sm bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">File Size:</span> 
                  <span className="ml-2 text-gray-600 dark:text-gray-400">{formatFileSize(viewingFile.size)}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">Type:</span> 
                  <span className="ml-2 text-gray-600 dark:text-gray-400">{viewingFile.type}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">Uploaded:</span> 
                  <span className="ml-2 text-gray-600 dark:text-gray-400">{viewingFile.uploadedAt.toLocaleDateString()}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">By:</span> 
                  <span className="ml-2 text-gray-600 dark:text-gray-400">{viewingFile.uploadedBy}</span>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button onClick={() => handleFileDownload(viewingFile.id)} className="bg-green-600 hover:bg-green-700">
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <Button variant="outline" onClick={() => setViewingFile(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
